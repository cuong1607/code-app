import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type ApiEnv,
  AppError,
  COMPOSITION_ENGINE_ID,
  type ImageAspect,
  type ImageAutoCheck,
  type ImageGenerateItemPayload,
  type ImageProviderId,
  IMAGE_PROVIDER_IDS,
  normalizeSearchText,
  toErrorMessage,
} from '@acs/shared';
import { AiUsageService } from '../ai/ai-usage.service';
import { SlidingWindowRateLimiter } from '../ai/ai-limits';
import { ImageProviderRegistry } from '../ai/image/image-provider.registry';
import {
  COLOR_CHECK_METHOD,
  COLOR_COVERAGE_WARN,
  compareColors,
  composeOnBackground,
  fitToAspect,
  normalizeReference,
} from '../ai/image/image-processing';
import { ProviderCallError } from '../ai/providers/provider-error';
import { APP_ENV } from '../config/app-config.module';
import { sha256Hex } from '../media/image-inspector';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { errorCodeOf, isRetryableImageError, toImageAppError } from './image-errors';
import { aggregateJobStatus } from './image.mapper';

/** Lỗi không thử lại (dữ liệu sai, từ chối, vượt ngân sách…) – hàng đợi chuyển thẳng sang failed. */
export class PermanentImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentImageError';
  }
}

export interface ProcessContext {
  /** Số lần BullMQ đã chạy job này trước lần hiện tại */
  attemptsMade: number;
  maxAttempts: number;
}

export type ProcessOutcome = 'completed' | 'skipped' | 'cancelled' | 'retry' | 'failed';

const MAX_REFERENCE_BYTES = 25 * 1024 * 1024;
export const COMPOSITION_MODEL = 'sharp-composition-v1';
export const DEFAULT_COMPOSITION_BG = '#F4F1EC';

/** Khoá đơn giá/ảnh lưu trong item.estimatedCostUsd -> chi phí ghi ai_usage. */
const num = (d: Prisma.Decimal | null) => (d === null ? null : Number(d));

/**
 * XỬ LÝ 1 ẢNH (1 job BullMQ):
 *  queued -> loading_references -> calling_provider (WAITING_PROVIDER) -> post_processing -> saving -> done
 * Idempotent: item đã xong / tác vụ đã huỷ -> bỏ qua. Lỗi tạm thời -> thử lại có giới hạn;
 * lỗi vĩnh viễn -> FAILED (không retry). Mọi lời gọi provider đều ghi ai_usage (kể cả lỗi).
 * Không để object mồ côi: ghi MinIO rồi tạo DB trong transaction, lỗi DB -> xoá object.
 */
@Injectable()
export class ImageItemProcessor {
  private readonly logger = new Logger(ImageItemProcessor.name);
  private readonly limiter: SlidingWindowRateLimiter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly registry: ImageProviderRegistry,
    private readonly usage: AiUsageService,
    private readonly settings: SettingsService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {
    this.limiter = new SlidingWindowRateLimiter(env.IMAGE_RATE_LIMIT_PER_MINUTE);
  }

  private async setItem(id: string, data: Prisma.ImageGenerationItemUpdateInput) {
    await this.prisma.imageGenerationItem.update({ where: { id }, data });
  }

  /** Cập nhật trạng thái tổng của tác vụ từ các item. */
  async refreshJob(jobId: string): Promise<void> {
    const job = await this.prisma.imageGenerationJob.findUnique({
      where: { id: jobId },
      include: { items: { select: { status: true, errorMessage: true } } },
    });
    if (!job) return;
    const status = aggregateJobStatus(job.status, job.items);
    const terminal = !['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(status);
    const failedMsg =
      status === 'FAILED' ? (job.items.find((i) => i.errorMessage)?.errorMessage ?? null) : null;
    await this.prisma.imageGenerationJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(status !== 'QUEUED' && !job.startedAt ? { startedAt: new Date() } : {}),
        finishedAt: terminal ? (job.finishedAt ?? new Date()) : null,
        errorMessage: failedMsg,
      },
    });
  }

  /** Chờ tới khi còn lượt gọi provider trong phút (rate limit theo provider), tối đa ~2 phút. */
  private async waitForRateSlot(provider: string) {
    for (let i = 0; i < 24; i += 1) {
      try {
        this.limiter.consume(`image:${provider}`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    throw new ProviderCallError('rate_limit', 'Hết lượt gọi provider trong thời gian chờ');
  }

  async process(payload: ImageGenerateItemPayload, ctx: ProcessContext): Promise<ProcessOutcome> {
    const item = await this.prisma.imageGenerationItem.findFirst({
      where: { id: payload.itemId, jobId: payload.jobId, workspaceId: payload.workspaceId },
      include: { job: true },
    });
    if (!item) throw new PermanentImageError('Không tìm thấy ảnh cần tạo (đã bị xoá?)');
    const job = item.job;

    if (item.status === 'COMPLETED' || item.status === 'FAILED' || item.status === 'CANCELLED') {
      return 'skipped';
    }
    if (job.status === 'CANCELLED') {
      await this.setItem(item.id, { status: 'CANCELLED', stage: 'cancelled' });
      await this.refreshJob(job.id);
      return 'cancelled';
    }
    // Chặn gọi lặp vô hạn (vd tiến trình chết giữa chừng nhiều lần)
    if (item.attempts >= ctx.maxAttempts) {
      await this.fail(
        item.id,
        job.id,
        'MAX_ATTEMPTS',
        'Đã thử tối đa số lần cho phép – dừng để tránh phát sinh chi phí',
      );
      return 'failed';
    }

    await this.setItem(item.id, {
      status: 'RUNNING',
      stage: 'loading_references',
      attempts: { increment: 1 },
      startedAt: item.startedAt ?? new Date(),
      errorCode: null,
      errorMessage: null,
    });
    await this.refreshJob(job.id);

    const isComposition = job.provider === COMPOSITION_ENGINE_ID;
    let providerCalled = false;
    const started = Date.now();
    const cost = num(item.estimatedCostUsd);
    try {
      const refs = await this.loadReferences(job.workspaceId, job.referenceAssetIds);

      let output: Buffer;
      let note: string | null = null;
      let usedModel = job.model;
      let tokens = { inputTokens: null as number | null, outputTokens: null as number | null };
      if (isComposition) {
        const settings = job.settings as { backgroundColor?: string };
        output = (
          await composeOnBackground(
            refs[0]!.original,
            job.aspect as ImageAspect,
            settings.backgroundColor ?? DEFAULT_COMPOSITION_BG,
          )
        ).data;
      } else {
        if (!(IMAGE_PROVIDER_IDS as readonly string[]).includes(job.provider))
          throw new PermanentImageError(`Provider "${job.provider}" không hợp lệ`);
        const { provider, model } = this.registry.require(
          job.provider as ImageProviderId,
          job.model,
        );
        await this.checkDailyBudget(job.workspaceId, cost);
        await this.waitForRateSlot(job.provider);

        await this.setItem(item.id, { status: 'WAITING_PROVIDER', stage: 'calling_provider' });
        await this.refreshJob(job.id);
        providerCalled = true;
        const res = await provider.editImage({
          model,
          prompt: item.prompt ?? '',
          negativePrompt: item.negativePrompt,
          aspect: job.aspect as ImageAspect,
          references: refs.map((r) => r.normalized),
          timeoutMs: this.env.IMAGE_REQUEST_TIMEOUT_MS,
          signal: AbortSignal.timeout(this.env.IMAGE_REQUEST_TIMEOUT_MS + 5000),
        });
        output = res.data;
        note = res.note;
        usedModel = res.model;
        tokens = res.usage;
      }

      // Huỷ trong lúc chờ provider -> bỏ kết quả (chi phí vẫn được ghi)
      const fresh = await this.prisma.imageGenerationJob.findUnique({
        where: { id: job.id },
        select: { status: true },
      });
      if (fresh?.status === 'CANCELLED') {
        if (providerCalled)
          await this.recordUsage(job, item.id, 'success', usedModel, tokens, started, null, 1);
        await this.setItem(item.id, { status: 'CANCELLED', stage: 'cancelled' });
        await this.refreshJob(job.id);
        return 'cancelled';
      }

      await this.setItem(item.id, { status: 'RUNNING', stage: 'post_processing' });
      const fitted = await fitToAspect(output, job.aspect as ImageAspect);
      const colors = await compareColors(refs[0]!.original, fitted.data).catch(() => null);
      const autoCheck: ImageAutoCheck = {
        colorCoverage: colors?.coverage ?? null,
        referencePalette: colors?.referencePalette ?? [],
        outputPalette: colors?.outputPalette ?? [],
        fit: fitted.fit,
        notes: [
          ...(fitted.fit.mode === 'pad'
            ? [
                `Provider trả ảnh ${fitted.fit.providerWidth}×${fitted.fit.providerHeight} – đã THÊM VIỀN (pad) thành ${fitted.fit.finalWidth}×${fitted.fit.finalHeight} để đúng tỷ lệ ${job.aspect}, không kéo giãn/cắt sản phẩm.`,
              ]
            : []),
          ...(isComposition
            ? ['Ảnh ghép từ ảnh gốc – sản phẩm giữ nguyên điểm ảnh gốc (chỉ thu nhỏ đồng đều).']
            : []),
          ...(note ? [`Ghi chú từ model: ${note}`] : []),
        ],
        flags: [
          ...(colors?.coverage !== null &&
          colors?.coverage !== undefined &&
          colors.coverage < COLOR_COVERAGE_WARN &&
          !isComposition
            ? ['color_low']
            : []),
          ...(fitted.fit.mode === 'pad' ? ['aspect_padded'] : []),
          ...(note ? ['provider_note'] : []),
        ],
        method: COLOR_CHECK_METHOD,
      };

      await this.setItem(item.id, { stage: 'saving' });
      await this.saveOutput(job, item.id, item.index, fitted, autoCheck, isComposition);
      if (providerCalled)
        await this.recordUsage(job, item.id, 'success', usedModel, tokens, started, null, 1);
      await this.setItem(item.id, { latencyMs: Date.now() - started });
      await this.refreshJob(job.id);
      return 'completed';
    } catch (error) {
      const appError =
        error instanceof PermanentImageError
          ? new AppError('VALIDATION_ERROR', error.message)
          : toImageAppError(error);
      if (providerCalled) {
        const status =
          error instanceof ProviderCallError && error.kind === 'refusal' ? 'refused' : 'failed';
        await this.recordUsage(
          job,
          item.id,
          status,
          job.model,
          { inputTokens: null, outputTokens: null },
          started,
          errorCodeOf(error),
          0,
        ).catch(() => undefined);
      }
      const retry =
        !(error instanceof PermanentImageError) &&
        isRetryableImageError(error) &&
        ctx.attemptsMade + 1 < ctx.maxAttempts;
      if (retry) {
        await this.setItem(item.id, {
          status: 'QUEUED',
          stage: 'queued',
          errorCode: errorCodeOf(error),
          errorMessage: `Lỗi tạm thời, sẽ thử lại: ${appError.message}`.slice(0, 500),
        });
        await this.refreshJob(job.id);
        return 'retry';
      }
      if (appError.code === 'BUDGET_EXCEEDED') {
        await this.recordUsage(
          job,
          item.id,
          'rejected_budget',
          job.model,
          { inputTokens: null, outputTokens: null },
          started,
          'BUDGET_EXCEEDED',
          0,
        ).catch(() => undefined);
      }
      this.logger.warn(`Ảnh ${item.id} lỗi: ${toErrorMessage(error)}`);
      await this.fail(item.id, job.id, errorCodeOf(error), appError.message);
      return 'failed';
    }
  }

  private async fail(itemId: string, jobId: string, code: string, message: string) {
    await this.setItem(itemId, {
      status: 'FAILED',
      stage: 'failed',
      errorCode: code.slice(0, 60),
      errorMessage: message.slice(0, 500),
      completedAt: new Date(),
    });
    await this.refreshJob(jobId);
  }

  private async checkDailyBudget(ws: string, cost: number | null) {
    const prefs = (await this.settings.get(ws)).preferences;
    // Item đang xử lý đã là RUNNING nên không nằm trong phần "đang chờ" (chỉ tính QUEUED)
    const pending = await this.usage.pendingImageCost(ws);
    const decision = await this.usage.checkBudget(ws, prefs, cost, { extraPendingUsd: pending });
    if (!decision.allowed)
      throw new AppError('BUDGET_EXCEEDED', decision.reason ?? 'Vượt ngân sách');
  }

  private async loadReferences(ws: string, ids: string[]) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, workspaceId: ws },
    });
    if (assets.length === 0) throw new PermanentImageError('Ảnh tham chiếu không còn tồn tại');
    // Giữ thứ tự người dùng chọn
    const ordered = ids.map((id) => assets.find((a) => a.id === id)).filter((a) => !!a);
    const out: Array<{
      original: Buffer;
      normalized: { data: Buffer; mimeType: 'image/jpeg' | 'image/png' };
    }> = [];
    for (const a of ordered) {
      const original = await this.storage.getBuffer(a.storageKey, MAX_REFERENCE_BYTES);
      if (sha256Hex(original) !== a.sha256) {
        throw new PermanentImageError(
          `Ảnh tham chiếu ${a.filename} trên storage không khớp bản ghi (đã bị thay đổi)`,
        );
      }
      out.push({ original, normalized: await normalizeReference(original) });
    }
    return out;
  }

  private async saveOutput(
    job: {
      id: string;
      workspaceId: string;
      productId: string | null;
      productName: string;
      provider: string;
      model: string;
      templateId: string;
      templateVersion: string;
      mode: string;
      aspect: string;
      referenceAssetIds: string[];
    },
    itemId: string,
    index: number,
    fitted: { data: Buffer; mimeType: string; fit: ImageAutoCheck['fit'] },
    autoCheck: ImageAutoCheck,
    isComposition: boolean,
  ) {
    const ext =
      fitted.mimeType === 'image/jpeg' ? 'jpg' : fitted.mimeType === 'image/webp' ? 'webp' : 'png';
    const now = new Date();
    const key = `ws/${job.workspaceId}/ai-images/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${itemId}.${ext}`;
    const sha256 = sha256Hex(fitted.data);
    const base =
      normalizeSearchText(job.productName)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60) || 'san-pham';
    const filename = `${base}-${isComposition ? 'ghep' : 'ai'}-${job.id.slice(0, 8)}-${index + 1}.${ext}`;

    // Trùng nội dung (rất hiếm) -> dùng lại tài nguyên đã có, không ghi object mới
    const dup = await this.prisma.mediaAsset.findUnique({
      where: { workspaceId_sha256: { workspaceId: job.workspaceId, sha256 } },
    });
    if (dup) {
      await this.setItem(itemId, {
        status: 'COMPLETED',
        stage: 'done',
        completedAt: new Date(),
        autoCheck: autoCheck as unknown as Prisma.InputJsonValue,
        mediaAsset: { connect: { id: dup.id } },
      });
      return;
    }

    await this.storage.putObject(key, fitted.data, fitted.mimeType);
    try {
      await this.prisma.$transaction(async (tx) => {
        const asset = await tx.mediaAsset.create({
          data: {
            workspaceId: job.workspaceId,
            filename,
            originalFilename: filename,
            storageKey: key,
            bucket: this.storage.bucket,
            mimeType: fitted.mimeType,
            fileSize: BigInt(fitted.data.length),
            width: fitted.fit.finalWidth,
            height: fitted.fit.finalHeight,
            sha256,
            assetType: isComposition ? 'COMPOSED_IMAGE' : 'AI_IMAGE',
            sourceType: 'generated',
            libraryVisible: false,
            searchText: normalizeSearchText(`${filename} ${job.productName}`),
            metadata: {
              generator: isComposition ? 'composition' : 'ai',
              isMock: job.provider === 'mock',
              imageJobId: job.id,
              imageItemId: itemId,
              productId: job.productId,
              provider: job.provider,
              model: job.model,
              templateId: job.templateId,
              templateVersion: job.templateVersion,
              mode: job.mode,
              aspect: job.aspect,
              sourceAssetIds: job.referenceAssetIds,
              fit: fitted.fit.mode,
            },
          },
        });
        await tx.imageGenerationItem.update({
          where: { id: itemId },
          data: {
            status: 'COMPLETED',
            stage: 'done',
            completedAt: new Date(),
            autoCheck: autoCheck as unknown as Prisma.InputJsonValue,
            mediaAssetId: asset.id,
          },
        });
      });
    } catch (error) {
      await this.storage.deleteObject(key).catch(() => undefined);
      throw error;
    }
  }

  private async recordUsage(
    job: { id: string; workspaceId: string; provider: string },
    itemId: string,
    status: 'success' | 'failed' | 'refused' | 'rejected_budget',
    model: string,
    tokens: { inputTokens: number | null; outputTokens: number | null },
    started: number,
    errorCode: string | null,
    succeeded: number,
  ) {
    const item = await this.prisma.imageGenerationItem.findUnique({
      where: { id: itemId },
      select: { estimatedCostUsd: true },
    });
    // Lời gọi lỗi: provider có thể vẫn tính phí token đầu vào nhưng không có số liệu đáng tin
    // -> để null (chưa xác định), KHÔNG ghi 0 như thể miễn phí.
    const cost = status === 'success' ? num(item?.estimatedCostUsd ?? null) : null;
    await this.usage.record(job.workspaceId, {
      provider: job.provider,
      model,
      feature: 'image_generate',
      status,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimatedCostUsd: cost,
      latencyMs: Date.now() - started,
      errorCode,
      imageJobId: job.id,
      imageItemId: itemId,
      imagesRequested: 1,
      imagesSucceeded: succeeded,
    });
  }
}
