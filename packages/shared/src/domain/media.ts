import { z } from 'zod';
import { paginationQuerySchema } from '../pagination';

/** Phân loại tài nguyên (khớp enum Prisma `MediaAssetType`). */
export const MEDIA_KINDS = ['ORIGINAL_IMAGE', 'AI_IMAGE', 'VIDEO', 'AUDIO', 'THUMBNAIL'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];
export type MediaAssetType = MediaKind;

export const MEDIA_SOURCE_TYPES = ['upload', 'import_url', 'generated', 'seed'] as const;
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number];

/** Ảnh được phép upload ở Phase 02. */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
export const IMAGE_EXTENSION: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Yêu cầu cấp URL upload (bước 1 của presigned upload). */
export const createUploadSchema = z.object({
  filename: z.string().trim().min(1, 'Thiếu tên file').max(255, 'Tên file quá dài'),
  contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
    error: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP',
  }),
  size: z.number().int().positive('Dung lượng file không hợp lệ'),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const uploadTicketSchema = z.object({
  uploadId: z.uuid(),
  uploadUrl: z.url(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
  maxBytes: z.number().int().positive(),
});
export type UploadTicket = z.infer<typeof uploadTicketSchema>;

export const mediaAssetSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  originalFilename: z.string(),
  mimeType: z.string(),
  fileSize: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  assetType: z.enum(MEDIA_KINDS),
  sourceType: z.enum(MEDIA_SOURCE_TYPES),
  sourceUrl: z.string().nullable(),
  sha256: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  /** URL xem trước có hạn (presigned GET) */
  previewUrl: z.string().nullable(),
  linkedProductCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

export const completeUploadResponseSchema = z.object({
  asset: mediaAssetSchema,
  /** true nếu nội dung trùng (theo SHA-256) với tài nguyên đã có – trả về tài nguyên cũ */
  duplicate: z.boolean(),
});
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;

export const MEDIA_SORT_KEYS = ['createdAt', 'filename', 'fileSize'] as const;
export const mediaListQuerySchema = paginationQuerySchema.extend({
  type: z.enum(MEDIA_KINDS).optional(),
  sortBy: z.enum(MEDIA_SORT_KEYS).default('createdAt'),
});
export type MediaListQuery = z.infer<typeof mediaListQuerySchema>;

export const mediaDownloadUrlSchema = z.object({
  url: z.url(),
  expiresAt: z.iso.datetime(),
});
