import { z } from 'zod';

export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'PROVIDER_NOT_CONFIGURED',
  'PROVIDER_ERROR',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Định dạng lỗi thống nhất mà API trả về cho client. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
    timestamp: z.iso.datetime(),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Lỗi nghiệp vụ có mã rõ ràng, dùng chung giữa api và worker. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}

/** Lấy thông điệp an toàn từ một giá trị bị throw bất kỳ. */
export function toErrorMessage(error: unknown): string {
  // Node gom lỗi kết nối IPv4+IPv6 thành AggregateError với message rỗng
  if (error instanceof AggregateError && error.errors.length > 0) {
    const inner = [...new Set(error.errors.map(toErrorMessage).filter(Boolean))];
    if (inner.length > 0) return inner.join('; ');
  }
  if (error instanceof Error) {
    if (error.message) return error.message;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : error.name;
  }
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Lỗi không xác định';
  }
}
