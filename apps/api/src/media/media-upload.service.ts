import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ApiEnv,
  AppError,
  type CompleteUploadResponse,
  type CreateUploadInput,
  IMAGE_EXTENSION,
  type UploadTicket,
  normalizeSearchText,
  toErrorMessage,
} from '@acs/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { inspectImage, sanitizeFilename } from './image-inspector';
import { MediaService } from './media.service';

/** Khoá object theo workspace: ws/<id>/images/<yyyy>/<mm>/<uuid>.<ext> */
export function buildImageKey(workspaceId: string, ext: string, now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `ws/${workspaceId}/images/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/**
 * Upload ảnh bằng presigned URL:
 *  1. createTicket: kiểm tra loại & dung lượng KHAI BÁO, tạo phiên upload (pending), cấp URL PUT có hạn.
 *  2. Trình duyệt PUT file thẳng lên MinIO.
 *  3. complete: SERVER đọc lại object, xác minh dung lượng THẬT + định dạng THẬT (magic bytes),
 *     tính SHA-256 (chống trùng) -> chỉ khi hợp lệ mới tạo MediaAsset.
 */
@Injectable()
export class MediaUploadService {
  private readonly logger = new Logger(MediaUploadService.name);
  private readonly maxBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly media: MediaService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {
    this.maxBytes = env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024;
  }

  async createTicket(workspaceId: string, input: CreateUploadInput): Promise<UploadTicket> {
    if (input.size > this.maxBytes) {
      throw new AppError('VALIDATION_ERROR', `File vượt quá ${this.env.MEDIA_MAX_UPLOAD_MB} MB`, {
        maxBytes: this.maxBytes,
      });
    }
    const storageKey = buildImageKey(workspaceId, IMAGE_EXTENSION[input.contentType]);
    const expiresAt = new Date(Date.now() + this.env.MEDIA_UPLOAD_TTL_SEC * 1000);
    const upload = await this.prisma.mediaUpload.create({
      data: {
        workspaceId,
        bucket: this.storage.bucket,
        storageKey,
        originalFilename: input.filename,
        declaredMimeType: input.contentType,
        declaredSize: input.size,
        expiresAt,
      },
    });
    const uploadUrl = await this.storage.presignPut(
      storageKey,
      input.contentType,
      this.env.MEDIA_UPLOAD_TTL_SEC,
    );
    return {
      uploadId: upload.id,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: expiresAt.toISOString(),
      maxBytes: this.maxBytes,
    };
  }

  async complete(workspaceId: string, uploadId: string): Promise<CompleteUploadResponse> {
    const upload = await this.prisma.mediaUpload.findFirst({
      where: { id: uploadId, workspaceId },
    });
    if (!upload) throw new AppError('NOT_FOUND', 'Không tìm thấy phiên upload');

    if (upload.status === 'completed' && upload.mediaAssetId) {
      // Gọi lại complete (VD: mạng chập chờn) -> trả kết quả cũ, không tạo trùng
      return { asset: await this.media.get(workspaceId, upload.mediaAssetId), duplicate: false };
    }
    if (upload.status !== 'pending') {
      throw new AppError(
        'CONFLICT',
        `Phiên upload đã ${upload.status === 'expired' ? 'hết hạn' : 'thất bại'}`,
        {
          reason: upload.failureReason,
        },
      );
    }
    if (upload.expiresAt.getTime() < Date.now()) {
      await this.fail(upload.id, upload.storageKey, 'Hết hạn trước khi hoàn tất', 'expired');
      throw new AppError('CONFLICT', 'Phiên upload đã hết hạn, vui lòng tải lên lại');
    }

    const head = await this.storage.head(upload.storageKey);
    if (!head) {
      // Giữ phiên pending để client có thể thử PUT lại trước khi hết hạn
      throw new AppError('VALIDATION_ERROR', 'Máy chủ chưa nhận được file. Hãy tải lên lại.');
    }
    if (head.size > this.maxBytes) {
      await this.fail(upload.id, upload.storageKey, `Dung lượng thật ${head.size} vượt giới hạn`);
      throw new AppError('VALIDATION_ERROR', `File vượt quá ${this.env.MEDIA_MAX_UPLOAD_MB} MB`);
    }
    if (head.size !== upload.declaredSize) {
      await this.fail(upload.id, upload.storageKey, 'Dung lượng không khớp khai báo');
      throw new AppError(
        'VALIDATION_ERROR',
        'Dung lượng file trên storage không khớp với khai báo',
      );
    }

    let inspected;
    try {
      const buf = await this.storage.getBuffer(upload.storageKey, this.maxBytes);
      inspected = inspectImage(buf, upload.declaredMimeType);
    } catch (error) {
      if (error instanceof AppError && error.code === 'VALIDATION_ERROR') {
        await this.fail(upload.id, upload.storageKey, error.message);
      }
      throw error;
    }

    // Chống trùng theo nội dung
    const existing = await this.prisma.mediaAsset.findUnique({
      where: { workspaceId_sha256: { workspaceId, sha256: inspected.sha256 } },
    });
    if (existing)
      return this.finishAsDuplicate(workspaceId, upload.id, upload.storageKey, existing.id);

    const filename = sanitizeFilename(upload.originalFilename, inspected.extension);
    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.mediaAsset.create({
          data: {
            workspaceId,
            filename,
            originalFilename: upload.originalFilename.slice(0, 255),
            storageKey: upload.storageKey,
            bucket: upload.bucket,
            mimeType: inspected.mimeType,
            fileSize: BigInt(inspected.size),
            width: inspected.width,
            height: inspected.height,
            sha256: inspected.sha256,
            assetType: 'ORIGINAL_IMAGE',
            sourceType: 'upload',
            searchText: normalizeSearchText(`${filename} ${upload.originalFilename}`),
          },
        });
        await tx.mediaUpload.update({
          where: { id: upload.id },
          data: { status: 'completed', mediaAssetId: created.id },
        });
        return created;
      });
      return {
        asset: await this.media.toDto({ ...asset, _count: { products: 0 } }),
        duplicate: false,
      };
    } catch (error) {
      // 2 upload cùng nội dung hoàn tất đồng thời
      if (isUniqueViolation(error)) {
        const dup = await this.prisma.mediaAsset.findUnique({
          where: { workspaceId_sha256: { workspaceId, sha256: inspected.sha256 } },
        });
        if (dup) return this.finishAsDuplicate(workspaceId, upload.id, upload.storageKey, dup.id);
      }
      throw error;
    }
  }

  private async finishAsDuplicate(
    workspaceId: string,
    uploadId: string,
    storageKey: string,
    assetId: string,
  ): Promise<CompleteUploadResponse> {
    await this.prisma.mediaUpload.update({
      where: { id: uploadId },
      data: {
        status: 'completed',
        mediaAssetId: assetId,
        failureReason: 'Trùng nội dung với tài nguyên đã có',
      },
    });
    await this.safeDelete(storageKey);
    return { asset: await this.media.get(workspaceId, assetId), duplicate: true };
  }

  private async fail(
    uploadId: string,
    storageKey: string,
    reason: string,
    status: 'failed' | 'expired' = 'failed',
  ): Promise<void> {
    await this.prisma.mediaUpload.update({
      where: { id: uploadId },
      data: { status, failureReason: reason.slice(0, 500) },
    });
    await this.safeDelete(storageKey);
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.storage.deleteObject(key);
    } catch (error) {
      this.logger.warn(
        `Chưa xoá được object ${key}: ${toErrorMessage(error)} (job dọn dẹp sẽ xử lý)`,
      );
    }
  }
}
