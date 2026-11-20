import type {
  ImageProvider,
  ImageProviderCapabilities,
  ImageProviderOutput,
  ImageProviderRequest,
  ProviderHealth,
  ProviderInfo,
} from '@acs/shared';
import { ProviderCallError } from '../../providers/provider-error';

/**
 * Lớp cơ sở cho ImageProvider: adapter chỉ cần triển khai `callProvider()` (MỘT lời gọi, không retry –
 * retry do hàng đợi BullMQ kiểm soát để không gọi lặp lại tốn tiền ngoài giới hạn).
 */
export abstract class BaseImageProvider implements ImageProvider {
  abstract readonly info: ProviderInfo;
  abstract readonly isMock: boolean;
  abstract isConfigured(): boolean;
  abstract getCapabilities(model: string): ImageProviderCapabilities;
  abstract validateConfiguration(model: string): Promise<ProviderHealth>;
  protected abstract callProvider(req: ImageProviderRequest): Promise<ImageProviderOutput>;

  private checkRequest(req: ImageProviderRequest) {
    const caps = this.getCapabilities(req.model);
    if (req.references.length > caps.maxReferenceImages) {
      throw new ProviderCallError(
        'bad_request',
        `Model chỉ nhận tối đa ${caps.maxReferenceImages} ảnh tham chiếu`,
      );
    }
    if (!req.prompt.trim()) throw new ProviderCallError('bad_request', 'Prompt rỗng');
  }

  // async: lỗi kiểm tra đầu vào luôn trả về Promise bị reject (không ném đồng bộ)
  async generateImage(req: ImageProviderRequest): Promise<ImageProviderOutput> {
    this.checkRequest(req);
    return this.callProvider(req);
  }

  async editImage(req: ImageProviderRequest): Promise<ImageProviderOutput> {
    if (req.references.length === 0) {
      throw new ProviderCallError('bad_request', 'Cần ít nhất 1 ảnh tham chiếu của sản phẩm');
    }
    if (!this.getCapabilities(req.model).supportsEditing) {
      throw new ProviderCallError('bad_request', 'Model không hỗ trợ tạo ảnh từ ảnh tham chiếu');
    }
    return this.generateImage(req);
  }

  async generateVariations(reqs: ImageProviderRequest[]) {
    const out: Array<{ ok: true; output: ImageProviderOutput } | { ok: false; error: unknown }> =
      [];
    for (const req of reqs) {
      try {
        out.push({ ok: true, output: await this.editImage(req) });
      } catch (error) {
        out.push({ ok: false, error });
      }
    }
    return out;
  }
}

/** Phân loại lỗi HTTP chung (dùng cho SDK không export lớp lỗi ổn định). */
export function mapHttpLikeError(error: unknown): ProviderCallError {
  if (error instanceof ProviderCallError) return error;
  const e = error as { status?: unknown; statusCode?: unknown; name?: unknown; code?: unknown };
  const status =
    typeof e?.status === 'number'
      ? e.status
      : typeof e?.statusCode === 'number'
        ? e.statusCode
        : undefined;
  const name = typeof e?.name === 'string' ? e.name : '';
  if (name === 'AbortError' || /timeout/i.test(name) || e?.code === 'ETIMEDOUT')
    return new ProviderCallError('timeout', 'Hết thời gian chờ');
  if (status === undefined) {
    if (
      /connection|fetch|network/i.test(name) ||
      e?.code === 'ECONNREFUSED' ||
      e?.code === 'ENOTFOUND'
    )
      return new ProviderCallError('network', 'Lỗi kết nối');
    return new ProviderCallError('unknown', 'Lỗi không xác định');
  }
  if (status === 401 || status === 403)
    return new ProviderCallError('auth', 'Xác thực thất bại', status);
  if (status === 429) return new ProviderCallError('rate_limit', 'Bị giới hạn tốc độ', status);
  if (status === 408) return new ProviderCallError('timeout', 'Hết thời gian chờ', status);
  if (status >= 500) return new ProviderCallError('overloaded', 'Lỗi phía nhà cung cấp', status);
  return new ProviderCallError('bad_request', 'Yêu cầu không hợp lệ', status);
}
