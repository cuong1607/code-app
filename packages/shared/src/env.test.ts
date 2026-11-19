import { describe, expect, it } from 'vitest';
import { apiEnvSchema, EnvValidationError, parseEnv, workerEnvSchema } from './env';

const validApiEnv = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET: 'acs-media',
};

describe('env', () => {
  it('áp dụng giá trị mặc định và tách CORS_ORIGINS', () => {
    const env = parseEnv(
      apiEnvSchema,
      { ...validApiEnv, CORS_ORIGINS: 'http://a.test, http://b.test' },
      'api',
    );
    expect(env.API_PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.APP_DISPLAY_TIMEZONE).toBe('Asia/Ho_Chi_Minh');
  });

  it('chuỗi rỗng cho API key được coi là chưa cấu hình', () => {
    const env = parseEnv(apiEnvSchema, { ...validApiEnv, ANTHROPIC_API_KEY: '' }, 'api');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('báo lỗi rõ ràng khi thiếu biến bắt buộc', () => {
    expect(() => parseEnv(apiEnvSchema, {}, 'api')).toThrow(EnvValidationError);
    try {
      parseEnv(apiEnvSchema, {}, 'api');
    } catch (error) {
      expect((error as EnvValidationError).issues.join('\n')).toContain('DATABASE_URL');
    }
  });

  it('từ chối khởi động production với AUTH_MODE=dev-local', () => {
    expect(() => parseEnv(apiEnvSchema, { ...validApiEnv, NODE_ENV: 'production' }, 'api')).toThrow(
      /AUTH_MODE=dev-local KHÔNG được phép/,
    );
  });

  it('cấu hình AI Script: mặc định an toàn, cấm Mock provider ở production', () => {
    const env = parseEnv(apiEnvSchema, validApiEnv, 'api');
    expect(env.ANTHROPIC_SCRIPT_MODEL).toBe('claude-opus-5-5');
    expect(env.OPENAI_SCRIPT_MODEL).toBeUndefined();
    expect(env.AI_MOCK_PROVIDER_ENABLED).toBe(false);
    expect(env.AI_MAX_RETRIES).toBe(2);
    expect(() =>
      parseEnv(
        apiEnvSchema,
        { ...validApiEnv, NODE_ENV: 'production', AI_MOCK_PROVIDER_ENABLED: 'true' },
        'api',
      ),
    ).toThrow(/MockScriptProvider/);
  });

  it('mặc định chỉ nghe loopback, dev workspace cố định, tắt tải ảnh từ URL', () => {
    const env = parseEnv(apiEnvSchema, validApiEnv, 'api');
    expect(env.API_HOST).toBe('127.0.0.1');
    expect(env.AUTH_MODE).toBe('dev-local');
    expect(env.IMPORT_IMAGE_ALLOWED_HOSTS).toEqual([]);
  });

  it('worker env có mặc định hợp lý', () => {
    const env = parseEnv(workerEnvSchema, {}, 'worker');
    expect(env.WORKER_CONCURRENCY).toBe(2);
    expect(env.FFMPEG_PATH).toBe('ffmpeg');
  });
});
