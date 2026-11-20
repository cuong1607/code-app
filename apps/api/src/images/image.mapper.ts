import type {
  ImageGenerationItem as ItemRow,
  ImageGenerationJob as JobRow,
  MediaAsset as MediaRow,
} from '@prisma/client';
import {
  IMAGE_MODE_META,
  IMAGE_REVIEW_FLAGS,
  type ImageAspect,
  type ImageAutoCheck,
  type ImageItem,
  type ImageJob,
  type ImageMode,
  type ImageReviewFlag,
  imageAutoCheckSchema,
} from '@acs/shared';
import { findImageTemplate } from '../ai/image/templates';
import { toMediaDto } from '../media/media.mapper';
import type { StorageService } from '../storage/storage.service';

export type ItemWithAsset = ItemRow & {
  mediaAsset: (MediaRow & { _count?: { products: number } }) | null;
};

interface PromptMeta {
  preserveRules?: string[];
  allowedChanges?: string[];
  warnings?: string[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function parseAutoCheck(raw: unknown): ImageAutoCheck | null {
  const r = imageAutoCheckSchema.safeParse(raw);
  return r.success ? r.data : null;
}

export async function toItemDto(row: ItemWithAsset, storage: StorageService): Promise<ImageItem> {
  const meta = (row.promptMeta ?? {}) as PromptMeta;
  return {
    id: row.id,
    jobId: row.jobId,
    index: row.index,
    status: row.status,
    stage: row.stage as ImageItem['stage'],
    attempts: row.attempts,
    prompt: row.prompt,
    preserveRules: meta.preserveRules ?? [],
    allowedChanges: meta.allowedChanges ?? [],
    warnings: meta.warnings ?? [],
    variationIndex: row.variationIndex,
    asset: row.mediaAsset ? await toMediaDto(row.mediaAsset, storage) : null,
    approvalStatus: row.approvalStatus,
    reviewNote: row.reviewNote,
    reviewFlags: row.reviewFlags.filter((f): f is ImageReviewFlag =>
      (IMAGE_REVIEW_FLAGS as readonly string[]).includes(f),
    ),
    reviewedAt: iso(row.reviewedAt),
    autoCheck: parseAutoCheck(row.autoCheck),
    savedToLibrary: row.mediaAsset?.libraryVisible ?? false,
    linkedToProduct: (row.mediaAsset?._count?.products ?? 0) > 0,
    regeneratedFromId: row.regeneratedFromId,
    estimatedCostUsd: row.estimatedCostUsd?.toFixed(6) ?? null,
    latencyMs: row.latencyMs,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    completedAt: iso(row.completedAt),
  };
}

export function countItems(
  items: Pick<ItemRow, 'status' | 'approvalStatus'>[],
): ImageJob['counts'] {
  const c = {
    total: items.length,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    approved: 0,
    rejected: 0,
  };
  for (const i of items) {
    if (i.status === 'QUEUED') c.queued += 1;
    else if (i.status === 'RUNNING' || i.status === 'WAITING_PROVIDER') c.running += 1;
    else if (i.status === 'COMPLETED') c.completed += 1;
    else if (i.status === 'FAILED') c.failed += 1;
    else if (i.status === 'CANCELLED') c.cancelled += 1;
    if (i.approvalStatus === 'approved') c.approved += 1;
    if (i.approvalStatus === 'rejected') c.rejected += 1;
  }
  return c;
}

export function toJobDto(
  row: JobRow,
  items: Pick<ItemRow, 'status' | 'approvalStatus'>[],
): ImageJob {
  const mode = row.mode as ImageMode;
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    mode,
    usesAi: IMAGE_MODE_META[mode]?.usesAi ?? true,
    templateId: row.templateId,
    templateName: findImageTemplate(row.templateId)?.name ?? row.templateId,
    templateVersion: row.templateVersion,
    styleId: row.styleId,
    aspect: row.aspect as ImageAspect,
    requestedCount: row.requestedCount,
    provider: row.provider,
    model: row.model,
    isMock: row.provider === 'mock',
    userPrompt: row.userPrompt,
    status: row.status,
    counts: countItems(items),
    estimatedCostUsd: row.estimatedCostUsd?.toFixed(6) ?? null,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt.toISOString(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
  };
}

/** Trạng thái tổng của tác vụ suy ra từ các item. */
export function aggregateJobStatus(
  current: JobRow['status'],
  items: Pick<ItemRow, 'status'>[],
): JobRow['status'] {
  if (current === 'CANCELLED') return 'CANCELLED';
  const has = (s: ItemRow['status']) => items.some((i) => i.status === s);
  if (has('WAITING_PROVIDER')) return 'WAITING_PROVIDER';
  if (has('RUNNING')) return 'RUNNING';
  if (has('QUEUED')) {
    return items.some((i) => i.status === 'COMPLETED' || i.status === 'FAILED')
      ? 'RUNNING'
      : 'QUEUED';
  }
  if (has('COMPLETED')) return 'COMPLETED';
  if (items.length > 0 && items.every((i) => i.status === 'CANCELLED')) return 'CANCELLED';
  return 'FAILED';
}
