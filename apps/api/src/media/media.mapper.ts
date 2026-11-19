import type { MediaAsset as MediaAssetRow } from '@prisma/client';
import type { MediaAsset } from '@acs/shared';
import type { StorageService } from '../storage/storage.service';

export const PREVIEW_URL_TTL_SEC = 15 * 60;
const PREVIEWABLE = new Set(['ORIGINAL_IMAGE', 'AI_IMAGE', 'THUMBNAIL']);

export type MediaRowWithCount = MediaAssetRow & { _count?: { products: number } };

/** Chuyển bản ghi DB -> DTO API, kèm URL xem trước có hạn (ký cục bộ, không gọi mạng). */
export async function toMediaDto(
  row: MediaRowWithCount,
  storage: StorageService,
): Promise<MediaAsset> {
  const previewUrl = PREVIEWABLE.has(row.assetType)
    ? await storage.presignGet(row.storageKey, { expiresInSec: PREVIEW_URL_TTL_SEC })
    : null;
  return {
    id: row.id,
    filename: row.filename,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    fileSize: Number(row.fileSize),
    width: row.width,
    height: row.height,
    assetType: row.assetType,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    sha256: row.sha256,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    previewUrl,
    linkedProductCount: row._count?.products ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
