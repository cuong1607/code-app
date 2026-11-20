import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AppError,
  type MediaAsset,
  type MediaListQuery,
  type Paginated,
  normalizeSearchText,
  toErrorMessage,
} from '@acs/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { type MediaRowWithCount, toMediaDto } from './media.mapper';

const DOWNLOAD_URL_TTL_SEC = 5 * 60;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  toDto(row: MediaRowWithCount): Promise<MediaAsset> {
    return toMediaDto(row, this.storage);
  }

  async list(workspaceId: string, q: MediaListQuery): Promise<Paginated<MediaAsset>> {
    const where: Prisma.MediaAssetWhereInput = {
      workspaceId,
      // Ảnh Image Studio chưa "Lưu vào thư viện" không hiện ở Thư viện media
      libraryVisible: true,
      ...(q.type ? { assetType: q.type } : {}),
      ...(q.search ? { searchText: { contains: normalizeSearchText(q.search) } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({
        where,
        orderBy: [{ [q.sortBy]: q.sortDir }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { products: true } } },
      }),
    ]);
    return {
      items: await Promise.all(rows.map((r) => this.toDto(r))),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async get(workspaceId: string, id: string): Promise<MediaAsset> {
    return this.toDto(await this.findOwned(workspaceId, id));
  }

  /** Kiểm tra quyền sở hữu: tài nguyên phải thuộc workspace hiện tại. */
  async findOwned(workspaceId: string, id: string): Promise<MediaRowWithCount> {
    const row = await this.prisma.mediaAsset.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { products: true } } },
    });
    if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy tài nguyên');
    return row;
  }

  async downloadUrl(workspaceId: string, id: string): Promise<{ url: string; expiresAt: string }> {
    const row = await this.findOwned(workspaceId, id);
    const head = await this.storage.head(row.storageKey);
    if (!head) {
      throw new AppError('NOT_FOUND', 'File không còn trên storage (có thể đã bị xoá thủ công)');
    }
    const url = await this.storage.presignGet(row.storageKey, {
      expiresInSec: DOWNLOAD_URL_TTL_SEC,
      downloadName: row.filename,
    });
    return { url, expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SEC * 1000).toISOString() };
  }

  /**
   * Xoá tài nguyên. Nếu đang liên kết với sản phẩm thì cần `force` (liên kết bị gỡ theo).
   * Xoá DB trước rồi mới xoá file; nếu xoá file lỗi, job dọn dẹp sẽ xử lý object mồ côi.
   */
  async remove(
    workspaceId: string,
    id: string,
    force: boolean,
  ): Promise<{ deleted: true; unlinkedProducts: number }> {
    const row = await this.findOwned(workspaceId, id);
    const linked = row._count?.products ?? 0;
    if (linked > 0 && !force) {
      throw new AppError(
        'CONFLICT',
        `Ảnh đang được dùng bởi ${linked} sản phẩm. Xác nhận xoá để gỡ khỏi các sản phẩm đó.`,
        {
          linkedProductCount: linked,
        },
      );
    }
    // Nếu ảnh là ảnh đại diện của sản phẩm nào, chọn ảnh kế tiếp làm đại diện
    const primaryOf = await this.prisma.productMedia.findMany({
      where: { mediaAssetId: id, isPrimary: true },
      select: { productId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.mediaAsset.delete({ where: { id } });
      for (const { productId } of primaryOf) {
        const next = await tx.productMedia.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
        });
        if (next) {
          await tx.productMedia.update({
            where: { productId_mediaAssetId: { productId, mediaAssetId: next.mediaAssetId } },
            data: { isPrimary: true },
          });
        }
      }
    });
    try {
      await this.storage.deleteObject(row.storageKey);
    } catch (error) {
      this.logger.warn(
        `Đã xoá bản ghi nhưng chưa xoá được file ${row.storageKey}: ${toErrorMessage(error)}`,
      );
    }
    return { deleted: true, unlinkedProducts: linked };
  }
}
