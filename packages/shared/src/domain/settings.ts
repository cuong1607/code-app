import { z } from 'zod';
import { DEFAULT_DISPLAY_TIMEZONE, DEFAULT_LOCALE } from '../constants';
import { SCRIPT_PROVIDER_IDS } from './script-engine';
import { ASPECT_RATIOS, VIDEO_DURATIONS, VIDEO_MODES, VIDEO_QUALITIES } from './video';

const AI_DEFAULTS = {
  defaultProvider: null,
  defaultModel: null,
  defaultTemplateId: 'review',
  maxVariants: 5,
  maxConcurrentRequests: 2,
  perGenerationBudgetUsd: 1,
  dailyBudgetUsd: 5,
  includePriceByDefault: false,
};

/**
 * Cài đặt KHÔNG nhạy cảm của workspace.
 * Tất cả object đều `.strict()` -> từ chối khoá lạ, nên không thể lén lưu API key/secret vào đây.
 */
export const appPreferencesSchema = z
  .object({
    videoDefaults: z
      .object({
        aspectRatio: z.enum(ASPECT_RATIOS).default('9:16'),
        durationSec: z.coerce
          .number()
          .refine(
            (v) => (VIDEO_DURATIONS as readonly number[]).includes(v),
            'Thời lượng không hợp lệ',
          )
          .default(30),
        quality: z.enum(VIDEO_QUALITIES).default('1080p'),
        templateId: z.string().max(100).default('tpl-fast-cut'),
        subtitles: z.boolean().default(true),
        watermark: z.boolean().default(false),
      })
      .strict()
      .default({
        aspectRatio: '9:16',
        durationSec: 30,
        quality: '1080p',
        templateId: 'tpl-fast-cut',
        subtitles: true,
        watermark: false,
      }),
    voice: z
      .object({
        voiceId: z.string().max(100).default('vi-female-north-1'),
        speed: z.number().min(0.5).max(2).default(1),
      })
      .strict()
      .default({ voiceId: 'vi-female-north-1', speed: 1 }),
    batch: z
      .object({
        concurrency: z.number().int().min(1).max(8).default(2),
        retries: z.number().int().min(0).max(10).default(3),
        backoffSec: z.number().int().min(1).max(3600).default(5),
        maxPerBatch: z.number().int().min(1).max(1000).default(100),
        pauseOnHighErrorRate: z.boolean().default(true),
      })
      .strict()
      .default({
        concurrency: 2,
        retries: 3,
        backoffSec: 5,
        maxPerBatch: 100,
        pauseOnHighErrorRate: true,
      }),
    cost: z
      .object({
        monthlyBudgetUsd: z.number().min(0).max(1_000_000).default(50),
        alertPercent: z.number().int().min(1).max(100).default(80),
        hardStop: z.boolean().default(true),
      })
      .strict()
      .default({ monthlyBudgetUsd: 50, alertPercent: 80, hardStop: true }),
    storage: z
      .object({
        tempRetentionDays: z.number().int().min(1).max(365).default(7),
      })
      .strict()
      .default({ tempRetentionDays: 7 }),
    /** AI Script Engine (Phase 03). Không chứa API key – key chỉ ở biến môi trường server. */
    ai: z
      .object({
        /** null = dùng AI_SCRIPT_PROVIDER ở server, hoặc provider đầu tiên đã cấu hình */
        defaultProvider: z.enum(SCRIPT_PROVIDER_IDS).nullable().default(null),
        /** null = model mặc định của provider */
        defaultModel: z.string().max(100).nullable().default(null),
        defaultTemplateId: z.string().max(60).default('review'),
        maxVariants: z.number().int().min(1).max(10).default(5),
        maxConcurrentRequests: z.number().int().min(1).max(5).default(2),
        perGenerationBudgetUsd: z.number().min(0).max(1000).default(1),
        dailyBudgetUsd: z.number().min(0).max(10_000).default(5),
        includePriceByDefault: z.boolean().default(false),
      })
      .strict()
      .default(AI_DEFAULTS),
  })
  .strict();
export type AppPreferences = z.infer<typeof appPreferencesSchema>;

export const appSettingsSchema = z.object({
  workspaceName: z.string().trim().min(1, 'Tên workspace không được trống').max(120),
  locale: z.literal(DEFAULT_LOCALE),
  timezone: z.literal(DEFAULT_DISPLAY_TIMEZONE),
  defaultVideoMode: z.enum(VIDEO_MODES),
  preferences: appPreferencesSchema,
  updatedAt: z.iso.datetime().nullable(),
});
export type AppSettings = z.infer<typeof appSettingsSchema>;

/**
 * Cập nhật từng phần. `preferences` là bản vá (deep-merge vào cài đặt hiện có) –
 * KẾT QUẢ sau khi gộp mới được kiểm tra bằng appPreferencesSchema (strict).
 * Không dùng schema có default ở đây, nếu không các nhóm không gửi lên sẽ bị reset.
 */
export const appSettingsUpdateSchema = z
  .object({
    workspaceName: z.string().trim().min(1, 'Tên workspace không được trống').max(120),
    defaultVideoMode: z.enum(VIDEO_MODES),
    preferences: z.record(z.string(), z.unknown()),
  })
  .partial()
  .strict();
export type AppSettingsUpdate = z.infer<typeof appSettingsUpdateSchema>;

/** Thông tin workspace hiện tại + chế độ truy cập. */
export const workspaceContextSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  authMode: z.literal('dev-local'),
});
export type WorkspaceContext = z.infer<typeof workspaceContextSchema>;
