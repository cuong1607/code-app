import { Injectable } from '@nestjs/common';
import type { PublishingDraft as PublishingRow, VideoDraft as VideoRow } from '@prisma/client';
import { z } from 'zod';
import {
  AppError,
  type PromptPreset,
  type PromptPresetInput,
  type PublishingDraft,
  type PublishingDraftInput,
  type VideoDraft,
  type VideoDraftConfig,
  type VideoDraftInput,
  publishingDraftUpdateSchema,
  videoDraftConfigSchema,
  videoDraftUpdateSchema,
} from '@acs/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { toMediaDto } from '../media/media.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';

type VideoUpdate = z.output<typeof videoDraftUpdateSchema>;
type PublishingUpdate = z.output<typeof publishingDraftUpdateSchema>;
type VideoRowWithScript = VideoRow & { script?: { title: string } | null };
const withScript = { script: { select: { title: true } } } as const;

/** Lưu bản nháp vào PostgreSQL. Mọi truy vấn lọc theo workspaceId (cô lập dữ liệu). */
@Injectable()
export class DraftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  // ================================================================== Video Factory
  private async toVideoDto(row: VideoRowWithScript): Promise<VideoDraft> {
    const assets = row.mediaAssetIds.length
      ? await this.prisma.mediaAsset.findMany({
          where: { id: { in: row.mediaAssetIds }, workspaceId: row.workspaceId },
        })
      : [];
    const byId = new Map(assets.map((a) => [a.id, a]));
    const images = await Promise.all(
      row.mediaAssetIds
        .map((id) => byId.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map(async (a) => ({
          id: a.id,
          filename: a.filename,
          previewUrl: (await toMediaDto(a, this.storage)).previewUrl,
        })),
    );
    return {
      id: row.id,
      name: row.name,
      batchKey: row.batchKey,
      productId: row.productId,
      productName: row.productName,
      prompt: row.prompt,
      config: videoDraftConfigSchema.parse(row.config) as VideoDraftConfig,
      mediaAssetIds: row.mediaAssetIds,
      scriptId: row.scriptId,
      scriptTitle: row.script?.title ?? null,
      images,
      status: 'draft',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Chế độ kiểm duyệt (Cài đặt › images.requireApprovalForVideo, mặc định BẬT):
   * ảnh tạo ở Image Studio chỉ được dùng cho video khi đã được DUYỆT.
   */
  private async assertApprovedForVideo(ws: string, mediaIds: string[]) {
    if (!mediaIds.length) return;
    const prefs = (await this.settings.get(ws)).preferences;
    if (!prefs.images.requireApprovalForVideo) return;
    const notApproved = await this.prisma.imageGenerationItem.count({
      where: {
        workspaceId: ws,
        mediaAssetId: { in: mediaIds },
        approvalStatus: { not: 'approved' },
      },
    });
    if (notApproved > 0) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Có ${notApproved} ảnh từ Image Studio chưa được duyệt. Hãy duyệt ảnh (so sánh với ảnh gốc) trước khi dùng cho video, hoặc tắt chế độ kiểm duyệt trong Cài đặt.`,
        [{ path: 'mediaAssetIds', message: 'Ảnh chưa được duyệt' }],
      );
    }
  }

  async listVideo(ws: string): Promise<VideoDraft[]> {
    const rows = await this.prisma.videoDraft.findMany({
      where: { workspaceId: ws },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      include: withScript,
    });
    return Promise.all(rows.map((r) => this.toVideoDto(r)));
  }

  async createVideo(ws: string, drafts: VideoDraftInput[]): Promise<VideoDraft[]> {
    const productIds = [
      ...new Set(drafts.map((d) => d.productId).filter((id): id is string => Boolean(id))),
    ];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, workspaceId: ws },
      select: { id: true, name: true },
    });
    if (products.length !== productIds.length)
      throw new AppError('NOT_FOUND', 'Có sản phẩm không tồn tại trong workspace');
    const mediaIds = [...new Set(drafts.flatMap((d) => d.mediaAssetIds))];
    const owned = await this.prisma.mediaAsset.count({
      where: { id: { in: mediaIds }, workspaceId: ws },
    });
    if (owned !== mediaIds.length)
      throw new AppError('NOT_FOUND', 'Có ảnh không tồn tại trong workspace');
    await this.assertApprovedForVideo(ws, mediaIds);
    const scriptIds = [
      ...new Set(drafts.map((d) => d.scriptId).filter((id): id is string => Boolean(id))),
    ];
    const ownedScripts = await this.prisma.scriptDraft.count({
      where: { id: { in: scriptIds }, workspaceId: ws },
    });
    if (ownedScripts !== scriptIds.length)
      throw new AppError('NOT_FOUND', 'Có kịch bản không tồn tại trong workspace');
    const nameOf = new Map(products.map((p) => [p.id, p.name]));

    const rows = await this.prisma.$transaction(
      drafts.map((d) =>
        this.prisma.videoDraft.create({
          data: {
            workspaceId: ws,
            name: d.name,
            batchKey: d.batchKey,
            productId: d.productId,
            productName: d.productId ? nameOf.get(d.productId)! : 'Không gắn sản phẩm',
            prompt: d.prompt,
            config: d.config,
            mediaAssetIds: d.mediaAssetIds,
            scriptId: d.scriptId,
          },
          include: withScript,
        }),
      ),
    );
    return Promise.all(rows.map((r) => this.toVideoDto(r)));
  }

  async updateVideo(ws: string, id: string, patch: VideoUpdate): Promise<VideoDraft> {
    await this.ownVideo(ws, id);
    const row = await this.prisma.videoDraft.update({
      where: { id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.prompt !== undefined && { prompt: patch.prompt }),
        ...(patch.config !== undefined && { config: patch.config }),
      },
      include: withScript,
    });
    return this.toVideoDto(row);
  }

  async deleteVideo(ws: string, ids: string[]): Promise<{ deleted: number }> {
    const { count } = await this.prisma.videoDraft.deleteMany({
      where: { id: { in: ids }, workspaceId: ws },
    });
    if (!count) throw new AppError('NOT_FOUND', 'Không tìm thấy luồng nháp');
    return { deleted: count };
  }

  private async ownVideo(ws: string, id: string) {
    const row = await this.prisma.videoDraft.findFirst({ where: { id, workspaceId: ws } });
    if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy luồng nháp');
    return row;
  }

  // ================================================================== Lịch đăng
  private toPublishingDto(row: PublishingRow): PublishingDraft {
    return {
      id: row.id,
      videoDraftId: row.videoDraftId,
      videoName: row.videoName,
      accountRef: row.accountRef,
      caption: row.caption,
      hashtags: row.hashtags,
      mode: row.mode,
      scheduledAt: row.scheduledAt.toISOString(),
      attachCart: row.attachCart,
      status: 'pending_review',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listPublishing(ws: string): Promise<PublishingDraft[]> {
    const rows = await this.prisma.publishingDraft.findMany({
      where: { workspaceId: ws },
      orderBy: { scheduledAt: 'asc' },
      take: 1000,
    });
    return rows.map((r) => this.toPublishingDto(r));
  }

  async createPublishing(ws: string, drafts: PublishingDraftInput[]): Promise<PublishingDraft[]> {
    if (drafts.some((d) => d.attachCart)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Gắn giỏ hàng chưa được hỗ trợ (cần tích hợp TikTok Shop)',
      );
    }
    const videoIds = [
      ...new Set(drafts.map((d) => d.videoDraftId).filter((id): id is string => Boolean(id))),
    ];
    const videos = await this.prisma.videoDraft.findMany({
      where: { id: { in: videoIds }, workspaceId: ws },
      select: { id: true, name: true },
    });
    if (videos.length !== videoIds.length)
      throw new AppError('NOT_FOUND', 'Có luồng video không tồn tại trong workspace');
    const nameOf = new Map(videos.map((v) => [v.id, v.name]));
    const rows = await this.prisma.$transaction(
      drafts.map((d) =>
        this.prisma.publishingDraft.create({
          data: {
            workspaceId: ws,
            videoDraftId: d.videoDraftId,
            videoName: d.videoDraftId ? nameOf.get(d.videoDraftId)! : 'Chưa chọn video',
            accountRef: d.accountRef,
            caption: d.caption,
            hashtags: d.hashtags,
            mode: d.mode,
            scheduledAt: new Date(d.scheduledAt),
            attachCart: false,
          },
        }),
      ),
    );
    return rows.map((r) => this.toPublishingDto(r));
  }

  async updatePublishing(
    ws: string,
    id: string,
    patch: PublishingUpdate,
  ): Promise<PublishingDraft> {
    const found = await this.prisma.publishingDraft.count({ where: { id, workspaceId: ws } });
    if (!found) throw new AppError('NOT_FOUND', 'Không tìm thấy bài đăng nháp');
    const row = await this.prisma.publishingDraft.update({
      where: { id },
      data: {
        ...(patch.caption !== undefined && { caption: patch.caption }),
        ...(patch.hashtags !== undefined && { hashtags: patch.hashtags }),
        ...(patch.scheduledAt !== undefined && { scheduledAt: new Date(patch.scheduledAt) }),
        ...(patch.accountRef !== undefined && { accountRef: patch.accountRef }),
      },
    });
    return this.toPublishingDto(row);
  }

  async deletePublishing(ws: string, ids: string[]): Promise<{ deleted: number }> {
    const { count } = await this.prisma.publishingDraft.deleteMany({
      where: { id: { in: ids }, workspaceId: ws },
    });
    if (!count) throw new AppError('NOT_FOUND', 'Không tìm thấy bài đăng nháp');
    return { deleted: count };
  }

  // ================================================================== Prompt đã lưu
  async listPrompts(ws: string, scope?: string): Promise<PromptPreset[]> {
    const rows = await this.prisma.promptPreset.findMany({
      where: { workspaceId: ws, ...(scope ? { scope } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope as PromptPreset['scope'],
      name: r.name,
      content: r.content,
      category: r.category,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async createPrompt(ws: string, input: PromptPresetInput): Promise<PromptPreset> {
    try {
      const r = await this.prisma.promptPreset.create({ data: { workspaceId: ws, ...input } });
      return {
        ...input,
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error))
        throw new AppError('CONFLICT', `Đã có prompt tên "${input.name}"`);
      throw error;
    }
  }

  async deletePrompt(ws: string, id: string): Promise<{ deleted: number }> {
    const { count } = await this.prisma.promptPreset.deleteMany({ where: { id, workspaceId: ws } });
    if (!count) throw new AppError('NOT_FOUND', 'Không tìm thấy prompt');
    return { deleted: count };
  }
}
