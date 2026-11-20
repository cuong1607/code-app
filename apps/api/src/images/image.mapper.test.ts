import { describe, expect, it } from 'vitest';
import { AppError, imageGenerateRequestSchema } from '@acs/shared';
import { ProviderCallError } from '../ai/providers/provider-error';
import { isRetryableImageError, toImageAppError } from './image-errors';
import { aggregateJobStatus, countItems } from './image.mapper';

type S = 'QUEUED' | 'RUNNING' | 'WAITING_PROVIDER' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
const items = (...s: S[]) => s.map((status) => ({ status }));

describe('Trạng thái tác vụ ảnh (job status)', () => {
  it('tổng hợp từ các item', () => {
    expect(aggregateJobStatus('QUEUED', items('QUEUED', 'QUEUED'))).toBe('QUEUED');
    expect(aggregateJobStatus('QUEUED', items('RUNNING', 'QUEUED'))).toBe('RUNNING');
    expect(aggregateJobStatus('RUNNING', items('WAITING_PROVIDER', 'COMPLETED'))).toBe(
      'WAITING_PROVIDER',
    );
    expect(aggregateJobStatus('RUNNING', items('COMPLETED', 'QUEUED'))).toBe('RUNNING');
    // Một ảnh lỗi không làm hỏng cả batch
    expect(aggregateJobStatus('RUNNING', items('COMPLETED', 'FAILED', 'COMPLETED'))).toBe(
      'COMPLETED',
    );
    expect(aggregateJobStatus('RUNNING', items('FAILED', 'FAILED'))).toBe('FAILED');
    expect(aggregateJobStatus('RUNNING', items('CANCELLED', 'CANCELLED'))).toBe('CANCELLED');
    expect(aggregateJobStatus('CANCELLED', items('RUNNING'))).toBe('CANCELLED');
  });

  it('đếm theo trạng thái & duyệt', () => {
    const c = countItems([
      { status: 'COMPLETED', approvalStatus: 'approved' },
      { status: 'COMPLETED', approvalStatus: 'rejected' },
      { status: 'FAILED', approvalStatus: 'pending' },
      { status: 'WAITING_PROVIDER', approvalStatus: 'pending' },
    ]);
    expect(c).toMatchObject({
      total: 4,
      completed: 2,
      failed: 1,
      running: 1,
      approved: 1,
      rejected: 1,
    });
  });
});

describe('Lỗi ảnh', () => {
  it('chỉ lỗi tạm thời được thử lại', () => {
    expect(isRetryableImageError(new ProviderCallError('rate_limit', 'x', 429))).toBe(true);
    expect(isRetryableImageError(new ProviderCallError('overloaded', 'x', 503))).toBe(true);
    expect(isRetryableImageError(new ProviderCallError('refusal', 'x'))).toBe(false);
    expect(isRetryableImageError(new ProviderCallError('auth', 'x', 401))).toBe(false);
    expect(isRetryableImageError(new AppError('SERVICE_UNAVAILABLE', 'redis'))).toBe(true);
    expect(isRetryableImageError(new AppError('BUDGET_EXCEEDED', 'x'))).toBe(false);
    expect(isRetryableImageError(new Error('?'))).toBe(false);
  });

  it('thông điệp tiếng Việt, không lộ chi tiết provider', () => {
    const e = toImageAppError(
      new ProviderCallError('refusal', 'raw provider text', undefined, { secret: 'x' }),
    );
    expect(e.message).toMatch(/AI không trả về ảnh/);
    expect(JSON.stringify(e.details)).not.toContain('secret');
  });
});

describe('Image Generation Request', () => {
  const base = {
    productId: '11111111-1111-4111-8111-111111111111',
    referenceAssetIds: ['22222222-2222-4222-8222-222222222222'],
    mode: 'lifestyle_interior',
    templateId: 'luxury_bedroom',
    idempotencyKey: '33333333-3333-4333-8333-333333333333',
  };
  it('mặc định 9:16, 1 ảnh', () => {
    expect(imageGenerateRequestSchema.parse(base)).toMatchObject({ aspect: '9:16', count: 1 });
  });
  it('từ chối số ảnh ngoài 1/3/5, khoá lạ (vd workspaceId), thiếu idempotencyKey, màu nền sai', () => {
    for (const bad of [
      { ...base, count: 4 },
      { ...base, count: 10 },
      { ...base, workspaceId: base.productId },
      { ...base, idempotencyKey: undefined },
      { ...base, referenceAssetIds: [] },
      { ...base, backgroundColor: 'red' },
      { ...base, userPrompt: 'x'.repeat(1001) },
    ]) {
      expect(
        imageGenerateRequestSchema.safeParse(bad).success,
        JSON.stringify(Object.keys(bad)),
      ).toBe(false);
    }
  });
});
