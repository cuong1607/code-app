import type { ImageAspect } from '../domain/image-engine';
import type { ProviderHealth, ProviderInfo } from './common';

/**
 * IMAGE PROVIDER (Phase 04). Triển khai ở apps/api/src/ai/image/providers – API key chỉ ở server.
 * Không giả định mọi model hỗ trợ mọi tính năng: khả năng được khai báo qua `getCapabilities()`.
 */
export interface ImageProviderCapabilities {
  /** Tạo ảnh có dùng ảnh tham chiếu (chỉnh sửa / ghép sản phẩm vào bối cảnh) */
  supportsEditing: boolean;
  /** Số ảnh tham chiếu tối đa mỗi lời gọi */
  maxReferenceImages: number;
  /** Tỷ lệ provider tạo trực tiếp; tỷ lệ khác sẽ được pad (không kéo méo) */
  nativeAspects: readonly ImageAspect[];
  /** Có tham số negative prompt riêng */
  negativePrompt: boolean;
  /** Số ảnh tối đa mỗi lời gọi (1 = mỗi ảnh một lời gọi) */
  maxImagesPerRequest: number;
  /** Provider trả kết quả bất đồng bộ (cần getJobStatus) */
  async: boolean;
  /** Mô tả độ phân giải đầu ra (vd "1K") */
  resolution: string;
  /** Đơn giá ƯỚC TÍNH mỗi ảnh (USD); null = chưa có đơn giá đáng tin cậy -> không cho chạy */
  pricePerImageUsd: number | null;
  /** Nguồn đơn giá (hiển thị cho người dùng) */
  pricingSource: string;
  /** Ghi chú watermark / quy định sử dụng (tiếng Việt) */
  notes: string[];
}

export interface ImageReferenceInput {
  data: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ImageProviderRequest {
  model: string;
  prompt: string;
  negativePrompt?: string | null;
  aspect: ImageAspect;
  references: ImageReferenceInput[];
  signal?: AbortSignal;
  timeoutMs: number;
}

export interface ImageProviderOutput {
  data: Buffer;
  mimeType: string;
  model: string;
  /** Token (nếu provider trả về) – chỉ để đối chiếu, chi phí vẫn là ước tính */
  usage: { inputTokens: number | null; outputTokens: number | null };
  /** Văn bản kèm theo (vd model giải thích/từ chối) – đã cắt ngắn */
  note: string | null;
  providerRequestId: string | null;
}

export interface ImageJobStatusResult {
  state: 'pending' | 'running' | 'succeeded' | 'failed';
  output?: ImageProviderOutput;
  error?: string;
}

export interface ImageProvider {
  readonly info: ProviderInfo;
  readonly isMock: boolean;
  isConfigured(): boolean;
  getCapabilities(model: string): ImageProviderCapabilities;
  /** Tạo ảnh từ prompt (ảnh tham chiếu tuỳ chọn) */
  generateImage(req: ImageProviderRequest): Promise<ImageProviderOutput>;
  /** Tạo ảnh dựa trên ảnh tham chiếu sản phẩm (bắt buộc ≥ 1 ảnh) */
  editImage(req: ImageProviderRequest): Promise<ImageProviderOutput>;
  /** Nhiều ảnh: mỗi prompt một lời gọi; lỗi từng ảnh không làm hỏng các ảnh khác */
  generateVariations(
    reqs: ImageProviderRequest[],
  ): Promise<Array<{ ok: true; output: ImageProviderOutput } | { ok: false; error: unknown }>>;
  /** Chỉ provider bất đồng bộ mới triển khai */
  getJobStatus?(providerJobId: string): Promise<ImageJobStatusResult>;
  validateConfiguration(model: string): Promise<ProviderHealth>;
}
