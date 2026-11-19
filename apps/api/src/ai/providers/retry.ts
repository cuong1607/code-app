import { ProviderCallError } from './provider-error';

export interface RetryPolicy {
  /** Số lần thử lại tối đa (không tính lần đầu) */
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY: RetryPolicy = { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 15_000 };

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ProviderCallError('timeout', 'Đã huỷ'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new ProviderCallError('timeout', 'Đã huỷ'));
      },
      { once: true },
    );
  });

/** Exponential backoff + jitter, có trần. */
export function backoffDelay(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const exp = policy.baseDelayMs * 2 ** attempt;
  return Math.min(policy.maxDelayMs, Math.round(exp * (0.75 + random() * 0.5)));
}

/**
 * Chạy `fn` với retry CÓ GIỚI HẠN – chỉ retry lỗi tạm thời (429/5xx/timeout/mạng).
 * Lỗi xác thực, request sai, từ chối… ném ngay (không gọi lặp lại vô hạn).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  opts: { signal?: AbortSignal; sleepFn?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const wait = opts.sleepFn ?? ((ms: number) => sleep(ms, opts.signal));
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      const retryable = error instanceof ProviderCallError && error.retryable;
      if (!retryable || attempt >= policy.maxRetries) throw error;
      await wait(backoffDelay(attempt, policy));
    }
  }
}
