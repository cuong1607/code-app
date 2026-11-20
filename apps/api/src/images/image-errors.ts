import { AppError } from '@acs/shared';
import { ProviderCallError, toAppError } from '../ai/providers/provider-error';

/** Lỗi ảnh -> AppError với thông điệp tiếng Việt phù hợp ảnh (không lộ phản hồi thô của provider). */
export function toImageAppError(error: unknown): AppError {
  if (error instanceof ProviderCallError) {
    if (error.kind === 'refusal')
      return new AppError(
        'PROVIDER_ERROR',
        'AI không trả về ảnh (có thể bị chặn bởi bộ lọc an toàn/bản quyền). Hãy đổi bối cảnh, prompt hoặc ảnh tham chiếu.',
        { reason: 'refusal' },
      );
    if (error.kind === 'invalid_output')
      return new AppError('PROVIDER_ERROR', 'Provider trả về ảnh không hợp lệ', {
        reason: 'invalid_output',
      });
    if (error.kind === 'bad_request')
      return new AppError(
        'PROVIDER_ERROR',
        `Nhà cung cấp AI từ chối yêu cầu: ${error.message}`.slice(0, 300),
        { reason: 'bad_request' },
      );
  }
  return toAppError(error);
}

/** Lỗi tạm thời -> hàng đợi được phép thử lại (có giới hạn). */
export function isRetryableImageError(error: unknown): boolean {
  if (error instanceof ProviderCallError) return error.retryable;
  if (error instanceof AppError) return error.code === 'SERVICE_UNAVAILABLE';
  return false;
}

export function errorCodeOf(error: unknown): string {
  if (error instanceof ProviderCallError) return `provider_${error.kind}`;
  if (error instanceof AppError) return error.code;
  return 'INTERNAL_ERROR';
}
