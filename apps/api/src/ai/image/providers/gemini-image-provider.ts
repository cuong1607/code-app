import { GoogleGenAI } from '@google/genai';
import {
  IMAGE_ASPECTS,
  type ImageProviderCapabilities,
  type ImageProviderOutput,
  type ImageProviderRequest,
  type ProviderHealth,
  type ProviderInfo,
} from '@acs/shared';
import { ProviderCallError } from '../../providers/provider-error';
import { GEMINI_IMAGE_MODELS, GEMINI_PRICING_SOURCE, geminiPricePerImage } from '../image-pricing';
import { BaseImageProvider, mapHttpLikeError } from './base-image-provider';

/** Cấu trúc tối thiểu của Interactions API mà adapter dùng (khớp @google/genai 3.6). */
export interface GeminiInteractionParams {
  model: string;
  input: Array<{ type: 'text'; text: string } | { type: 'image'; mime_type: string; data: string }>;
  response_format: { type: 'image'; aspect_ratio: string; image_size: string };
  store: boolean;
}
export interface GeminiInteractionResult {
  id: string;
  status: string;
  model?: string;
  output_image?: { data?: string; mime_type?: string };
  output_text?: string;
  usage?: { total_input_tokens?: number; total_output_tokens?: number };
}
export interface GeminiClientLike {
  interactions: {
    create(
      params: GeminiInteractionParams,
      options: { timeout_ms: number; retries: { strategy: 'none' }; signal?: AbortSignal },
    ): Promise<GeminiInteractionResult>;
  };
  models: { get(params: { model: string }): Promise<{ name?: string }> };
}

export interface GeminiImageConfig {
  apiKey?: string;
  imageSize: '1K' | '2K';
}

/**
 * GeminiImageProvider – Google Gemini image generation qua SDK chính thức @google/genai
 * (Interactions API: `interactions.create` + `response_format: {type:'image', aspect_ratio, image_size}`).
 *  - Ảnh tham chiếu gửi inline base64 (tối đa theo model: 10 ảnh đối tượng với 3.1 Flash Image).
 *  - Không có negative prompt (tài liệu khuyên mô tả tích cực) -> ràng buộc ghi trong prompt.
 *  - store=false: không lưu interaction phía Google. SDK retry tắt – hàng đợi kiểm soát retry.
 *  - Mọi ảnh có watermark SynthID (theo tài liệu).
 */
export class GeminiImageProvider extends BaseImageProvider {
  readonly info: ProviderInfo = { id: 'gemini', kind: 'image', displayName: 'Google Gemini' };
  readonly isMock = false;
  private client?: GeminiClientLike;

  constructor(
    private readonly config: GeminiImageConfig,
    clientFactory?: () => GeminiClientLike,
  ) {
    super();
    if (clientFactory) this.client = clientFactory();
  }

  isConfigured(): boolean {
    return Boolean(this.client || this.config.apiKey);
  }

  private getClient(): GeminiClientLike {
    if (!this.client) {
      if (!this.config.apiKey)
        throw new ProviderCallError('not_configured', 'Thiếu GOOGLE_API_KEY');
      const sdk = new GoogleGenAI({ apiKey: this.config.apiKey });
      this.client = {
        interactions: {
          create: (params, options) =>
            sdk.interactions.create(
              params as never,
              options as never,
            ) as unknown as Promise<GeminiInteractionResult>,
        },
        models: { get: (params) => sdk.models.get(params) },
      };
    }
    return this.client;
  }

  getCapabilities(model: string): ImageProviderCapabilities {
    const spec = GEMINI_IMAGE_MODELS[model];
    return {
      supportsEditing: true,
      maxReferenceImages: spec?.maxReferenceImages ?? 1,
      nativeAspects: IMAGE_ASPECTS,
      negativePrompt: false,
      maxImagesPerRequest: 1,
      async: false,
      resolution: this.config.imageSize,
      pricePerImageUsd: geminiPricePerImage(model, this.config.imageSize),
      pricingSource: spec ? GEMINI_PRICING_SOURCE : 'Chưa có đơn giá cho model này',
      notes: [
        'Ảnh do Gemini tạo có watermark vô hình SynthID.',
        'Sử dụng theo Chính sách sử dụng bị cấm của Google Generative AI.',
      ],
    };
  }

  protected async callProvider(req: ImageProviderRequest): Promise<ImageProviderOutput> {
    const client = this.getClient();
    let res: GeminiInteractionResult;
    try {
      res = await client.interactions.create(
        {
          model: req.model,
          input: [
            ...req.references.map((r) => ({
              type: 'image' as const,
              mime_type: r.mimeType,
              data: r.data.toString('base64'),
            })),
            { type: 'text' as const, text: req.prompt },
          ],
          response_format: {
            type: 'image',
            aspect_ratio: req.aspect,
            image_size: this.config.imageSize,
          },
          store: false,
        },
        { timeout_ms: req.timeoutMs, retries: { strategy: 'none' }, signal: req.signal },
      );
    } catch (error) {
      throw mapHttpLikeError(error);
    }
    const note = res.output_text ? res.output_text.slice(0, 500) : null;
    if (res.status === 'failed' || res.status === 'cancelled') {
      throw new ProviderCallError(
        'overloaded',
        `Interaction kết thúc với trạng thái ${res.status}`,
      );
    }
    if (res.status === 'budget_exceeded') {
      throw new ProviderCallError('bad_request', 'Vượt giới hạn chi tiêu của tài khoản Google');
    }
    const data = res.output_image?.data;
    if (!data) {
      // Không có ảnh: thường là model từ chối (an toàn/bản quyền) và chỉ trả lời bằng chữ
      throw new ProviderCallError('refusal', 'Model không trả về ảnh', undefined, { note });
    }
    return {
      data: Buffer.from(data, 'base64'),
      mimeType: res.output_image?.mime_type ?? 'image/png',
      model: res.model ?? req.model,
      usage: {
        inputTokens: res.usage?.total_input_tokens ?? null,
        outputTokens: res.usage?.total_output_tokens ?? null,
      },
      note,
      providerRequestId: res.id ?? null,
    };
  }

  async validateConfiguration(model: string): Promise<ProviderHealth> {
    if (!this.isConfigured()) return { available: false, message: 'Chưa cấu hình GOOGLE_API_KEY' };
    try {
      await this.getClient().models.get({ model });
      return { available: true, message: `Kết nối thành công – model ${model}` };
    } catch (error) {
      const e = mapHttpLikeError(error);
      return {
        available: false,
        message:
          e.kind === 'auth'
            ? 'API key không hợp lệ hoặc không có quyền'
            : e.status === 404
              ? `Model "${model}" không tồn tại hoặc tài khoản không được dùng`
              : e.kind === 'network' || e.kind === 'timeout'
                ? 'Không kết nối được tới Google AI'
                : 'Kiểm tra thất bại',
      };
    }
  }
}
