import { z } from 'zod';
import { PUBLISH_MODES } from './publish';
import {
  ASPECT_RATIOS,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_QUALITIES,
  type VideoDuration,
} from './video';

// ------------------------------------------------------------------ Video Factory
export const videoDraftConfigSchema = z.object({
  aspectRatio: z.enum(ASPECT_RATIOS),
  durationSec: z
    .number()
    .int()
    .refine((v) => (VIDEO_DURATIONS as readonly number[]).includes(v), 'Thời lượng không hợp lệ')
    .transform((v) => v as VideoDuration),
  quality: z.enum(VIDEO_QUALITIES),
  mode: z.enum(VIDEO_MODES),
  voiceId: z.string().min(1).max(100),
  templateId: z.string().min(1).max(100),
});
export type VideoDraftConfig = z.infer<typeof videoDraftConfigSchema>;

export const videoDraftInputSchema = z.object({
  name: z.string().trim().min(1, 'Thiếu tên luồng').max(200),
  batchKey: z.string().trim().min(1).max(80),
  productId: z.uuid().nullable(),
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt không được để trống')
    .max(4000, 'Prompt tối đa 4000 ký tự'),
  config: videoDraftConfigSchema,
  mediaAssetIds: z.array(z.uuid()).max(20).default([]),
  /** Kịch bản (phiên bản cụ thể) dùng làm đầu vào – Phase 03 */
  scriptId: z.uuid().nullable().default(null),
});
export type VideoDraftInput = z.infer<typeof videoDraftInputSchema>;

export const createVideoDraftsSchema = z.object({
  drafts: z.array(videoDraftInputSchema).min(1).max(200, 'Tối đa 200 luồng mỗi lần'),
});

export const videoDraftUpdateSchema = videoDraftInputSchema
  .pick({ name: true, prompt: true, config: true })
  .partial();

export const videoDraftSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  batchKey: z.string(),
  productId: z.uuid().nullable(),
  productName: z.string(),
  prompt: z.string(),
  config: videoDraftConfigSchema,
  mediaAssetIds: z.array(z.uuid()),
  scriptId: z.uuid().nullable(),
  scriptTitle: z.string().nullable(),
  /** URL xem trước của các ảnh tham chiếu còn tồn tại */
  images: z.array(
    z.object({ id: z.uuid(), previewUrl: z.string().nullable(), filename: z.string() }),
  ),
  status: z.literal('draft'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type VideoDraft = z.infer<typeof videoDraftSchema>;

// ------------------------------------------------------------------ Lịch đăng
export const PUBLISH_CAPTION_MAX = 2200;
export const PUBLISH_MAX_HASHTAGS = 30;

export const publishingDraftInputSchema = z.object({
  videoDraftId: z.uuid().nullable(),
  /** Tài khoản TikTok – null khi chưa kết nối (Phase 08) */
  accountRef: z.string().trim().max(100).nullable(),
  caption: z.string().max(PUBLISH_CAPTION_MAX, `Caption tối đa ${PUBLISH_CAPTION_MAX} ký tự`),
  hashtags: z
    .array(z.string().regex(/^#[^\s#]{1,100}$/, 'Hashtag không hợp lệ'))
    .max(PUBLISH_MAX_HASHTAGS, `Tối đa ${PUBLISH_MAX_HASHTAGS} hashtag`),
  mode: z.enum(PUBLISH_MODES),
  scheduledAt: z.iso.datetime({ message: 'Thời gian phải là ISO UTC' }),
  attachCart: z.boolean().default(false),
});
export type PublishingDraftInput = z.infer<typeof publishingDraftInputSchema>;

export const createPublishingDraftsSchema = z.object({
  drafts: z.array(publishingDraftInputSchema).min(1).max(200),
});

export const publishingDraftUpdateSchema = publishingDraftInputSchema
  .pick({ caption: true, hashtags: true, scheduledAt: true, accountRef: true })
  .partial();

export const publishingDraftSchema = z.object({
  id: z.uuid(),
  videoDraftId: z.uuid().nullable(),
  videoName: z.string(),
  accountRef: z.string().nullable(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  mode: z.enum(PUBLISH_MODES),
  scheduledAt: z.iso.datetime(),
  attachCart: z.boolean(),
  status: z.literal('pending_review'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PublishingDraft = z.infer<typeof publishingDraftSchema>;

// Kịch bản: xem ./script-engine.ts (Phase 03 – thay cho scriptContentSchema v1 của Phase 02)

// ------------------------------------------------------------------ Prompt đã lưu
export const PROMPT_SCOPES = ['video', 'script', 'image'] as const;
export const promptPresetInputSchema = z.object({
  scope: z.enum(PROMPT_SCOPES),
  name: z.string().trim().min(1, 'Thiếu tên prompt').max(100, 'Tên prompt tối đa 100 ký tự'),
  content: z
    .string()
    .trim()
    .min(1, 'Prompt không được để trống')
    .max(4000, 'Prompt tối đa 4000 ký tự'),
  category: z.string().trim().max(50).nullable().default(null),
});
export type PromptPresetInput = z.infer<typeof promptPresetInputSchema>;
export const promptPresetSchema = promptPresetInputSchema.extend({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PromptPreset = z.infer<typeof promptPresetSchema>;
