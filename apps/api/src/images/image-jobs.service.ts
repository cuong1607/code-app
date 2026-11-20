import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type ApiEnv,
  AppError,
  COMPOSITION_ENGINE_ID,
  IMAGE_JOB_ACTIVE_STATUSES,
  IMAGE_MODE_META,
  type ImageEstimate,
  type ImageGenerateRequest,
  type ImageJob,
  type ImageJobDetail,
  type ImageJobListQuery,
  type ImageProductContext,
  type ImagePrompt,
  type ImageReviewInput,
  type Paginated,
  productVisualContextSchema,
  toErrorMessage,
} from '@acs/shared';
import { AiUsageService } from '../ai/ai-usage.service';
import { SlidingWindowRateLimiter } from '../ai/ai-limits';
import { buildImagePrompt } from '../ai/image/image-prompt-builder';
import { ImageProviderRegistry } from '../ai/image/image-provider.registry';
import { findImageTemplate, matchTemplates, templateApplicability } from '../ai/image/templates';
import { buildVisualContext } from '../ai/image/visual-context';
import { usd } from '../ai/pricing';
import { APP_ENV } from '../config/app-config.module';
import { MediaService } from '../media/media.service';
import { toMediaDto } from '../media/media.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { ProductMediaService } from '../products/product-media.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { COMPOSITION_MODEL, DEFAULT_COMPOSITION_BG } from './image-item.processor';
import { ImageQueueService } from './image-queue.service';
import { toItemDto, toJobDto } from './image.mapper';

type EstimateInput = Omit<ImageGenerateRequest, 'idempotencyKey'> & { idempotencyKey?: string };

interface PreparedJob {
  productId: string;
  productName: string;
  visualContext: ReturnType<typeof buildVisualContext>;
  usesAi: boolean;
  provider: string;
  model: string;
  isMock: boolean;
  pricePerImage: number | null;
  pricingSource: string;
  prompts: ImagePrompt[];
  templateVersion: string;
  aspectHandling: 'native' | 'pad';
}

const ITEM_INCLUDE = {
  mediaAsset: { include: { _count: { select: { products: true } } } },
} as const;

@Injectable()
export class ImageJobsService {
  private readonly logger = new Logger(ImageJobsService.name);
  private readonly limiter: SlidingWindowRateLimiter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly registry: ImageProviderRegistry,
    private readonly usage: AiUsageService,
    private readonly settings: SettingsService,
    private readonly queue: ImageQueueService,
    private readonly media: MediaService,
    private readonly productMedia: ProductMediaService,
    @Inject(APP_ENV) env: ApiEnv,
  ) {
    this.limiter = new SlidingWindowRateLimiter(env.AI_RATE_LIMIT_PER_MINUTE);
  }

  // ------------------------------------------------------------------ Ngữ cảnh sản phẩm
  private async loadProduct(ws: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId: ws },
      include: {
        media: {
          include: { mediaAsset: true },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
      },
    });
    if (!product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
    return product;
  }

  async productContext(ws: string, productId: string): Promise<ImageProductContext> {
    const product = await this.loadProduct(ws, productId);
    const visualContext = buildVisualContext(product);
    const refs = product.media
      .map((m) => m.mediaAsset)
      .filter((a) => a.assetType === 'ORIGINAL_IMAGE');
    return {
      visualContext,
      references: await Promise.all(refs.map((a) => toMediaDto(a, this.storage))),
      templates: matchTemplates(visualContext),
    };
  }

  // ------------------------------------------------------------------ Chuẩn bị (dùng chung estimate/create)
  private async prepare(ws: string, input: EstimateInput): Promise<PreparedJob> {
    const product = await this.loadProduct(ws, input.productId);
    const allowedRefs = new Map(
      product.media
        .filter((m) => m.mediaAsset.assetType === 'ORIGINAL_IMAGE')
        .map((m) => [m.mediaAssetId, m.mediaAsset]),
    );
    const refIds = [...new Set(input.referenceAssetIds)];
    if (refIds.some((id) => !allowedRefs.has(id))) {
      throw new AppError(
        'VALIDATION_ERROR',
        'Ảnh tham chiếu phải là ảnh gốc đã gắn với sản phẩm này',
        [{ path: 'referenceAssetIds', message: 'Ảnh không thuộc sản phẩm' }],
      );
    }
    const template = findImageTemplate(input.templateId);
    if (!template)
      throw new AppError('VALIDATION_ERROR', 'Template ảnh không tồn tại', [
        { path: 'templateId', message: 'Không tồn tại' },
      ]);
    const visualContext = buildVisualContext(product);
    const applicability = templateApplicability(template, visualContext, input.mode);
    if (!applicability.applicable) {
      throw new AppError(
        'VALIDATION_ERROR',
        applicability.reason ?? 'Template không áp dụng được',
        [{ path: 'templateId', message: applicability.reason ?? 'Không áp dụng' }],
      );
    }

    const base = {
      productId: product.id,
      productName: product.name,
      visualContext,
      templateVersion: template.version,
    };

    // Mode F: ghép ảnh gốc – không AI, không chi phí
    if (!IMAGE_MODE_META[input.mode].usesAi) {
      if (input.count !== 1) {
        throw new AppError('VALIDATION_ERROR', 'Chế độ ghép ảnh gốc chỉ tạo 1 ảnh mỗi lần', [
          { path: 'count', message: 'Chỉ 1 ảnh' },
        ]);
      }
      return {
        ...base,
        usesAi: false,
        provider: COMPOSITION_ENGINE_ID,
        model: COMPOSITION_MODEL,
        isMock: false,
        pricePerImage: 0,
        pricingSource: 'Xử lý ảnh trên server – không gọi AI, không phát sinh chi phí AI',
        prompts: [],
        aspectHandling: 'native',
      };
    }

    const prefs = (await this.settings.get(ws)).preferences;
    const providerId = input.provider ?? this.registry.resolveDefault(prefs.images.defaultProvider);
    if (!providerId) {
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'Chưa có nhà cung cấp ảnh AI nào được cấu hình. Đặt GOOGLE_API_KEY (Gemini) hoặc OPENAI_API_KEY + OPENAI_IMAGE_MODEL ở server.',
      );
    }
    const { model, capabilities } = this.registry.require(providerId, input.model);
    if (refIds.length > capabilities.maxReferenceImages) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Model ${model} nhận tối đa ${capabilities.maxReferenceImages} ảnh tham chiếu`,
        [{ path: 'referenceAssetIds', message: 'Quá nhiều ảnh' }],
      );
    }
    const prompts = Array.from({ length: input.count }, (_, i) =>
      buildImagePrompt({
        context: visualContext,
        template,
        mode: input.mode,
        aspect: input.aspect,
        styleId: input.styleId,
        userPrompt: input.userPrompt,
        referenceCount: refIds.length,
        variationIndex: input.count > 1 || input.mode === 'batch_variations' ? i : 0,
        capabilities: { negativePrompt: capabilities.negativePrompt },
      }),
    );
    return {
      ...base,
      usesAi: true,
      provider: providerId,
      model,
      isMock: providerId === 'mock',
      pricePerImage: capabilities.pricePerImageUsd,
      pricingSource: capabilities.pricingSource,
      prompts,
      aspectHandling: capabilities.nativeAspects.includes(input.aspect) ? 'native' : 'pad',
    };
  }

  private async budget(ws: string, prepared: PreparedJob, count: number) {
    const prefs = (await this.settings.get(ws)).preferences;
    const total = prepared.pricePerImage === null ? null : prepared.pricePerImage * count;
    if (!prepared.usesAi) {
      return {
        total: 0,
        decision: {
          allowed: true,
          reason: null,
          remainingDailyUsd: prefs.ai.dailyBudgetUsd,
          remainingMonthlyUsd: null,
        },
      };
    }
    const pending = await this.usage.pendingImageCost(ws);
    const decision = await this.usage.checkBudget(ws, prefs, total, { extraPendingUsd: pending });
    return { total, decision };
  }

  async estimate(ws: string, input: EstimateInput): Promise<ImageEstimate> {
    const prepared = await this.prepare(ws, input);
    const { total, decision } = await this.budget(ws, prepared, input.count);
    return {
      usesAi: prepared.usesAi,
      provider: prepared.provider,
      model: prepared.model,
      isMock: prepared.isMock,
      count: input.count,
      pricePerImageUsd: prepared.pricePerImage === null ? null : usd(prepared.pricePerImage),
      estimatedCostUsd: total === null ? null : usd(total),
      pricingKnown: prepared.pricePerImage !== null,
      pricingSource: prepared.pricingSource,
      allowed: decision.allowed,
      reason: decision.reason,
      remainingDailyUsd: usd(decision.remainingDailyUsd),
      promptPreview: prepared.prompts[0] ?? null,
      aspectHandling: prepared.aspectHandling,
    };
  }

  // ------------------------------------------------------------------ Tạo tác vụ
  async create(
    ws: string,
    input: ImageGenerateRequest,
  ): Promise<{ job: ImageJobDetail; created: boolean }> {
    const existing = await this.prisma.imageGenerationJob.findUnique({
      where: {
        workspaceId_idempotencyKey: { workspaceId: ws, idempotencyKey: input.idempotencyKey },
      },
    });
    if (existing) return { job: await this.detail(ws, existing.id), created: false };

    const prepared = await this.prepare(ws, input);
    const { total, decision } = await this.budget(ws, prepared, input.count);
    if (!decision.allowed) throw new AppError('BUDGET_EXCEEDED', decision.reason!, decision);
    if (prepared.usesAi) this.limiter.consume(`image:${ws}`, input.count);

    const per = prepared.pricePerImage;
    let jobId: string;
    try {
      const job = await this.prisma.imageGenerationJob.create({
        data: {
          workspaceId: ws,
          productId: prepared.productId,
          productName: prepared.productName.slice(0, 200),
          idempotencyKey: input.idempotencyKey,
          mode: input.mode,
          templateId: input.templateId,
          templateVersion: prepared.templateVersion,
          styleId: prepared.prompts[0]?.styleId ?? input.styleId ?? null,
          aspect: input.aspect,
          requestedCount: input.count,
          provider: prepared.provider,
          model: prepared.model,
          userPrompt: input.userPrompt ?? null,
          referenceAssetIds: [...new Set(input.referenceAssetIds)],
          visualContext: prepared.visualContext as unknown as Prisma.InputJsonValue,
          settings: {
            backgroundColor: input.backgroundColor ?? DEFAULT_COMPOSITION_BG,
            styleId: input.styleId ?? null,
          },
          estimatedCostUsd: total === null ? null : new Prisma.Decimal(usd(total)),
          items: {
            create: Array.from({ length: input.count }, (_, i) => {
              const p = prepared.prompts[i];
              return {
                workspaceId: ws,
                index: i,
                variationIndex: p?.variationIndex ?? 0,
                prompt: p?.prompt ?? null,
                negativePrompt: p?.negativePrompt ?? null,
                promptMeta: p
                  ? {
                      preserveRules: p.preserveRules,
                      allowedChanges: p.allowedChanges,
                      warnings: p.warnings,
                      builderVersion: p.builderVersion,
                    }
                  : { preserveRules: [], allowedChanges: [], warnings: [] },
                estimatedCostUsd: per === null ? null : new Prisma.Decimal(usd(per)),
              };
            }),
          },
        },
        include: { items: { select: { id: true } } },
      });
      jobId = job.id;
      await this.enqueueSafely(
        ws,
        job.id,
        job.items.map((i) => i.id),
      );
    } catch (error) {
      // Hai request cùng idempotencyKey chạy song song -> trả job đã tạo
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const dup = await this.prisma.imageGenerationJob.findUnique({
          where: {
            workspaceId_idempotencyKey: { workspaceId: ws, idempotencyKey: input.idempotencyKey },
          },
        });
        if (dup) return { job: await this.detail(ws, dup.id), created: false };
      }
      throw error;
    }
    return { job: await this.detail(ws, jobId), created: true };
  }

  /** Redis lỗi lúc tạo -> job vẫn nằm trong DB (QUEUED) và được khôi phục tự động khi Redis hoạt động lại. */
  private async enqueueSafely(ws: string, jobId: string, itemIds: string[]) {
    try {
      await this.queue.enqueue(itemIds.map((itemId) => ({ workspaceId: ws, jobId, itemId })));
    } catch (error) {
      this.logger.warn(
        `Chưa đưa được job ảnh ${jobId} vào hàng đợi: ${toErrorMessage(error)} – sẽ khôi phục sau`,
      );
    }
  }

  // ------------------------------------------------------------------ Đọc
  async list(ws: string, q: ImageJobListQuery): Promise<Paginated<ImageJob>> {
    const where: Prisma.ImageGenerationJobWhereInput = {
      workspaceId: ws,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.imageGenerationJob.count({ where }),
      this.prisma.imageGenerationJob.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { items: { select: { status: true, approvalStatus: true } } },
      }),
    ]);
    return {
      items: rows.map((r) => toJobDto(r, r.items)),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  async detail(ws: string, jobId: string): Promise<ImageJobDetail> {
    const job = await this.prisma.imageGenerationJob.findFirst({
      where: { id: jobId, workspaceId: ws },
      include: { items: { include: ITEM_INCLUDE, orderBy: { index: 'asc' } } },
    });
    if (!job) throw new AppError('NOT_FOUND', 'Không tìm thấy tác vụ tạo ảnh');
    const refs = await this.prisma.mediaAsset.findMany({
      where: { id: { in: job.referenceAssetIds }, workspaceId: ws },
      include: { _count: { select: { products: true } } },
    });
    const ordered = job.referenceAssetIds
      .map((id) => refs.find((r) => r.id === id))
      .filter((r) => !!r);
    const ctx = productVisualContextSchema.safeParse(job.visualContext);
    return {
      ...toJobDto(job, job.items),
      references: await Promise.all(ordered.map((r) => toMediaDto(r, this.storage))),
      items: await Promise.all(job.items.map((i) => toItemDto(i, this.storage))),
      visualContext: ctx.success ? ctx.data : null,
    };
  }

  private async findItem(ws: string, itemId: string) {
    const item = await this.prisma.imageGenerationItem.findFirst({
      where: { id: itemId, workspaceId: ws },
      include: { job: true, ...ITEM_INCLUDE },
    });
    if (!item) throw new AppError('NOT_FOUND', 'Không tìm thấy ảnh');
    return item;
  }

  // ------------------------------------------------------------------ Thao tác
  async cancel(ws: string, jobId: string): Promise<ImageJobDetail> {
    const job = await this.prisma.imageGenerationJob.findFirst({
      where: { id: jobId, workspaceId: ws },
      include: { items: true },
    });
    if (!job) throw new AppError('NOT_FOUND', 'Không tìm thấy tác vụ tạo ảnh');
    if (!IMAGE_JOB_ACTIVE_STATUSES.includes(job.status)) {
      throw new AppError('CONFLICT', 'Tác vụ đã kết thúc – không thể huỷ');
    }
    const queued = job.items.filter((i) => i.status === 'QUEUED').map((i) => i.id);
    await this.prisma.$transaction([
      this.prisma.imageGenerationJob.update({
        where: { id: jobId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), finishedAt: new Date() },
      }),
      this.prisma.imageGenerationItem.updateMany({
        where: { id: { in: queued } },
        data: { status: 'CANCELLED', stage: 'cancelled' },
      }),
    ]);
    await this.queue
      .removePending(queued)
      .catch((e) => this.logger.warn(`Gỡ job khỏi hàng đợi lỗi: ${toErrorMessage(e)}`));
    return this.detail(ws, jobId);
  }

  async review(
    ws: string,
    itemId: string,
    decision: 'approved' | 'rejected',
    input: ImageReviewInput,
  ) {
    const item = await this.findItem(ws, itemId);
    if (item.status !== 'COMPLETED' || !item.mediaAssetId) {
      throw new AppError('CONFLICT', 'Chỉ duyệt/từ chối được ảnh đã tạo xong');
    }
    await this.prisma.imageGenerationItem.update({
      where: { id: itemId },
      data: {
        approvalStatus: decision,
        reviewNote: input.note ?? null,
        reviewFlags: input.flags,
        reviewedAt: new Date(),
      },
    });
    // Ảnh bị từ chối không được nằm trong thư viện
    if (decision === 'rejected') {
      await this.prisma.mediaAsset.update({
        where: { id: item.mediaAssetId },
        data: { libraryVisible: false },
      });
    }
    return toItemDto(await this.findItem(ws, itemId), this.storage);
  }

  /** Tạo lại 1 ảnh: item MỚI trong cùng tác vụ (ảnh cũ giữ nguyên để so sánh). */
  async regenerate(ws: string, itemId: string): Promise<ImageJobDetail> {
    const source = await this.findItem(ws, itemId);
    const job = source.job;
    if (['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(source.status)) {
      throw new AppError('CONFLICT', 'Ảnh đang được tạo – chờ xong rồi mới tạo lại');
    }
    const active = await this.prisma.imageGenerationItem.count({
      where: {
        regeneratedFromId: itemId,
        status: { in: ['QUEUED', 'RUNNING', 'WAITING_PROVIDER'] },
      },
    });
    if (active > 0) throw new AppError('CONFLICT', 'Ảnh này đang được tạo lại');

    const usesAi = job.provider !== COMPOSITION_ENGINE_ID;
    if (usesAi) {
      const { capabilities } = this.registry.require(job.provider as never, job.model);
      const prefs = (await this.settings.get(ws)).preferences;
      const decision = await this.usage.checkBudget(ws, prefs, capabilities.pricePerImageUsd, {
        extraPendingUsd: await this.usage.pendingImageCost(ws),
      });
      if (!decision.allowed) throw new AppError('BUDGET_EXCEEDED', decision.reason!, decision);
      this.limiter.consume(`image:${ws}`, 1);
    }
    const max = await this.prisma.imageGenerationItem.aggregate({
      where: { jobId: job.id },
      _max: { index: true },
    });
    const created = await this.prisma.$transaction(async (tx) => {
      const it = await tx.imageGenerationItem.create({
        data: {
          workspaceId: ws,
          jobId: job.id,
          index: (max._max.index ?? 0) + 1,
          variationIndex: source.variationIndex,
          prompt: source.prompt,
          negativePrompt: source.negativePrompt,
          promptMeta: source.promptMeta as Prisma.InputJsonValue,
          regeneratedFromId: source.id,
          estimatedCostUsd: source.estimatedCostUsd,
        },
      });
      await tx.imageGenerationJob.update({
        where: { id: job.id },
        data: { status: 'QUEUED', finishedAt: null, cancelledAt: null, errorMessage: null },
      });
      return it;
    });
    await this.enqueueSafely(ws, job.id, [created.id]);
    return this.detail(ws, job.id);
  }

  async saveToLibrary(ws: string, itemId: string) {
    const item = await this.findItem(ws, itemId);
    if (item.status !== 'COMPLETED' || !item.mediaAssetId)
      throw new AppError('CONFLICT', 'Ảnh chưa tạo xong');
    if (item.approvalStatus === 'rejected')
      throw new AppError('CONFLICT', 'Ảnh đã bị từ chối – không lưu vào thư viện');
    await this.prisma.mediaAsset.update({
      where: { id: item.mediaAssetId },
      data: { libraryVisible: true },
    });
    return toItemDto(await this.findItem(ws, itemId), this.storage);
  }

  /** Gắn ảnh ĐÃ DUYỆT vào sản phẩm (ảnh gốc của sản phẩm không bị thay đổi). */
  async linkToProduct(ws: string, itemId: string) {
    const item = await this.findItem(ws, itemId);
    if (item.status !== 'COMPLETED' || !item.mediaAssetId)
      throw new AppError('CONFLICT', 'Ảnh chưa tạo xong');
    if (item.approvalStatus !== 'approved')
      throw new AppError('CONFLICT', 'Chỉ gắn được ảnh đã duyệt vào sản phẩm');
    if (!item.job.productId) throw new AppError('CONFLICT', 'Sản phẩm của tác vụ đã bị xoá');
    await this.prisma.mediaAsset.update({
      where: { id: item.mediaAssetId },
      data: { libraryVisible: true },
    });
    await this.productMedia.attach(ws, item.job.productId, [item.mediaAssetId]);
    return toItemDto(await this.findItem(ws, itemId), this.storage);
  }

  async downloadUrl(ws: string, itemId: string) {
    const item = await this.findItem(ws, itemId);
    if (!item.mediaAssetId) throw new AppError('NOT_FOUND', 'Ảnh chưa có file');
    return this.media.downloadUrl(ws, item.mediaAssetId);
  }
}
