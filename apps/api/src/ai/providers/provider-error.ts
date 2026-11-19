import { AppError } from '@acs/shared';

export type ProviderErrorKind =
  | 'auth' // key sai / hết hạn / không có quyền
  | 'not_configured' // thiếu key hoặc model
  | 'rate_limit' // 429 từ provider
  | 'overloaded' // 5xx / 529
  | 'timeout'
  | 'network'
  | 'bad_request' // 400 – lỗi do request (không retry)
  | 'refusal' // model từ chối
  | 'truncated' // hết max token trước khi xong
  | 'invalid_output' // JSON sai sau khi đã thử sửa
  | 'unknown';

const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set([
  'rate_limit',
  'overloaded',
  'timeout',
  'network',
]);

/** Lỗi đã phân loại của provider. KHÔNG chứa API key hay nội dung phản hồi thô. */
export class ProviderCallError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ProviderCallError';
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.kind);
  }
}

const KIND_MESSAGE: Record<ProviderErrorKind, string> = {
  auth: 'API key của nhà cung cấp AI không hợp lệ, hết hạn hoặc không có quyền dùng model này',
  not_configured: 'Nhà cung cấp AI chưa được cấu hình ở server',
  rate_limit: 'Nhà cung cấp AI đang giới hạn tốc độ – vui lòng thử lại sau ít phút',
  overloaded: 'Nhà cung cấp AI đang quá tải hoặc gặp sự cố – vui lòng thử lại sau',
  timeout: 'Nhà cung cấp AI phản hồi quá thời gian cho phép',
  network: 'Không kết nối được tới nhà cung cấp AI',
  bad_request: 'Nhà cung cấp AI từ chối yêu cầu (tham số không hợp lệ)',
  refusal: 'AI từ chối tạo nội dung này. Hãy điều chỉnh yêu cầu hoặc dữ liệu sản phẩm',
  truncated: 'Kịch bản bị cắt ngang do vượt giới hạn độ dài phản hồi',
  invalid_output: 'AI trả về kịch bản không hợp lệ sau số lần sửa cho phép',
  unknown: 'Lỗi không xác định từ nhà cung cấp AI',
};

/** Chuyển lỗi provider -> AppError chuẩn (thông điệp tiếng Việt, không lộ chi tiết nhạy cảm). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof ProviderCallError) {
    const message = KIND_MESSAGE[error.kind];
    const details = {
      reason: error.kind,
      ...(error.kind === 'invalid_output' ? { issues: error.details } : {}),
    };
    if (error.kind === 'not_configured' || error.kind === 'auth')
      return new AppError('PROVIDER_NOT_CONFIGURED', message, details);
    if (error.kind === 'rate_limit') return new AppError('RATE_LIMITED', message, details);
    return new AppError('PROVIDER_ERROR', message, details);
  }
  return new AppError('PROVIDER_ERROR', KIND_MESSAGE.unknown, { reason: 'unknown' });
}
