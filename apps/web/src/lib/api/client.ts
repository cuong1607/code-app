/**
 * HTTP client dùng chung để gọi NestJS API.
 *
 * - Trên server (RSC/route handler): gọi thẳng API_INTERNAL_URL.
 * - Trên trình duyệt: gọi qua proxy cùng origin `/api/backend/*` (xem app/api/backend),
 *   nên không cần CORS và không lộ địa chỉ nội bộ. Không bao giờ gửi API key AI từ client.
 */
import { type ErrorCode, errorResponseSchema, toErrorMessage } from '@acs/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE',
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Schema Zod để kiểm tra phản hồi (khuyến nghị) */
  schema?: z.ZodType<T>;
  /** Ghi đè base URL (dùng trong test) */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  }
  return '/api/backend';
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: ApiRequestOptions<unknown>['query'],
): string {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions<T> = {},
): Promise<T> {
  const {
    method = 'GET',
    query,
    body,
    signal,
    timeoutMs = 15_000,
    schema,
    baseUrl = resolveApiBaseUrl(),
    fetchImpl = fetch,
  } = options;

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  let res: Response;
  try {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    res = await fetchImpl(buildUrl(baseUrl, path, query), {
      method,
      // FormData: để trình duyệt tự đặt multipart boundary
      headers: body !== undefined && !isForm ? { 'content-type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: combined,
      cache: 'no-store',
    });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new ApiError(`Máy chủ không phản hồi sau ${timeoutMs / 1000} giây`, 0, 'TIMEOUT');
    }
    throw new ApiError(`Không kết nối được máy chủ: ${toErrorMessage(error)}`, 0, 'NETWORK_ERROR');
  }

  const text = await res.text();
  let json: unknown = undefined;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new ApiError('Phản hồi từ máy chủ không phải JSON', res.status, 'INVALID_RESPONSE');
    }
  }

  if (!res.ok) {
    const parsed = errorResponseSchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details, requestId } = parsed.data.error;
      throw new ApiError(message, res.status, code, details, requestId);
    }
    throw new ApiError(`Máy chủ trả lỗi HTTP ${res.status}`, res.status, 'INTERNAL_ERROR');
  }

  if (!schema) return json as T;
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      'Dữ liệu trả về không đúng định dạng',
      res.status,
      'INVALID_RESPONSE',
      parsed.error.issues,
    );
  }
  return parsed.data;
}

/** Thông báo lỗi tiếng Việt thân thiện cho UI. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return toErrorMessage(error);
}
