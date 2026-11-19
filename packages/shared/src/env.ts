import { z } from 'zod';
import { DEFAULT_DISPLAY_TIMEZONE, DEFAULT_LOCALE } from './constants';

/** Chuỗi rỗng trong .env được coi như "không đặt". */
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const port = z.coerce.number().int().min(1).max(65535);

const commonEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'info', 'debug', 'verbose']).default('info'),
  APP_DISPLAY_TIMEZONE: z.string().default(DEFAULT_DISPLAY_TIMEZONE),
  APP_DEFAULT_LOCALE: z.string().default(DEFAULT_LOCALE),
});

const redisEnvSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: port.default(6379),
  REDIS_PASSWORD: optionalString,
  QUEUE_PREFIX: z.string().min(1).default('acs'),
});

const s3EnvSchema = z.object({
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(3),
  S3_FORCE_PATH_STYLE: booleanFromString.default(true),
});

const aiEnvSchema = z.object({
  AI_SCRIPT_PROVIDER: optionalString,
  AI_IMAGE_PROVIDER: optionalString,
  AI_TTS_PROVIDER: optionalString,
  AI_VIDEO_PROVIDER: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GOOGLE_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,
});

/** Workspace phát triển cố định (seed tạo sẵn). KHÔNG phải xác thực. */
export const DEV_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

export const apiEnvSchema = commonEnvSchema
  .extend(redisEnvSchema.shape)
  .extend(s3EnvSchema.shape)
  .extend(aiEnvSchema.shape)
  .extend({
    API_PORT: port.default(4000),
    // Mặc định chỉ nghe trên loopback: API chưa có xác thực (Phase 09)
    API_HOST: z.string().default('127.0.0.1'),
    /**
     * dev-local: mọi request được gán vào DEV_WORKSPACE_ID và CHỈ chấp nhận kết nối từ máy cục bộ.
     * Không phải xác thực thật – bị cấm trong production (xem refine bên dưới).
     */
    AUTH_MODE: z.enum(['dev-local']).default('dev-local'),
    DEV_WORKSPACE_ID: z.uuid().default(DEV_WORKSPACE_ID),
    /** Endpoint S3 mà TRÌNH DUYỆT dùng cho presigned URL (mặc định = S3_ENDPOINT) */
    S3_PUBLIC_ENDPOINT: z.preprocess(emptyToUndefined, z.url().optional()),
    MEDIA_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
    MEDIA_UPLOAD_TTL_SEC: z.coerce.number().int().min(60).max(3600).default(900),
    MEDIA_CLEANUP_INTERVAL_SEC: z.coerce.number().int().min(0).max(86_400).default(600),
    /** Tên miền được phép tải ảnh từ URL (phân tách dấu phẩy). Rỗng = tắt tính năng. */
    IMPORT_IMAGE_ALLOWED_HOSTS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((h) => h.trim().toLowerCase())
          .filter(Boolean),
      ),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    DATABASE_URL: z
      .string()
      .min(1)
      .refine((value) => /^postgres(ql)?:\/\//.test(value), {
        message: 'DATABASE_URL phải bắt đầu bằng postgresql://',
      }),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.AUTH_MODE === 'dev-local') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message:
          'AUTH_MODE=dev-local KHÔNG được phép khi NODE_ENV=production (chưa có xác thực thật – dự kiến Phase 09)',
      });
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = commonEnvSchema
  .extend(redisEnvSchema.shape)
  .extend(aiEnvSchema.shape)
  .extend({
    WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(64).default(2),
    WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
    FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  });

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export class EnvValidationError extends Error {
  constructor(
    public readonly service: string,
    public readonly issues: string[],
  ) {
    super(`[${service}] Biến môi trường không hợp lệ:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

/**
 * Kiểm tra biến môi trường bằng schema Zod.
 * Ném EnvValidationError với thông báo dễ đọc thay vì để service chạy với cấu hình sai.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
  service: string,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new EnvValidationError(service, issues);
  }
  return result.data;
}
