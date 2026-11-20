import OpenAI, { toFile } from 'openai';
import {
  IMAGE_ASPECTS,
  type ImageProviderCapabilities,
  type ImageProviderOutput,
  type ImageProviderRequest,
  type ProviderHealth,
  type ProviderInfo,
} from '@acs/shared';
import { mapOpenAIError } from '../../providers/openai-script-provider';
import { ProviderCallError } from '../../providers/provider-error';
import { OPENAI_SIZES } from '../image-pricing';
import { BaseImageProvider } from './base-image-provider';

export interface OpenAIImagesClientLike {
  images: { edit: OpenAI['images']['edit'] };
  models: { retrieve: OpenAI['models']['retrieve'] };
}

export interface OpenAIImageConfig {
  apiKey?: string;
  quality: 'low' | 'medium' | 'high';
  pricePerImageUsd: number | null;
}

/** Số ảnh tham chiếu gửi tối đa – tài liệu không công bố giới hạn, chọn mức an toàn. */
export const OPENAI_MAX_REFERENCES = 4;

/**
 * OpenAIImageProvider – Image API chính thức (`images.edit` với mảng ảnh tham chiếu).
 *  - Model BẮT BUỘC cấu hình qua OPENAI_IMAGE_MODEL (không hardcode model ID).
 *  - Chi phí tính theo token, không có bảng giá theo ảnh -> cần OPENAI_IMAGE_PRICE_PER_IMAGE_USD.
 *  - Không có negative prompt; n=1 mỗi lời gọi (mỗi ảnh một job để lỗi không lan sang ảnh khác).
 */
export class OpenAIImageProvider extends BaseImageProvider {
  readonly info: ProviderInfo = { id: 'openai', kind: 'image', displayName: 'OpenAI GPT Image' };
  readonly isMock = false;
  private client?: OpenAIImagesClientLike;

  constructor(
    private readonly config: OpenAIImageConfig,
    clientFactory?: () => OpenAIImagesClientLike,
  ) {
    super();
    if (clientFactory) this.client = clientFactory();
  }

  isConfigured(): boolean {
    return Boolean(this.client || this.config.apiKey);
  }

  private getClient(): OpenAIImagesClientLike {
    if (!this.client) {
      if (!this.config.apiKey)
        throw new ProviderCallError('not_configured', 'Thiếu OPENAI_API_KEY');
      this.client = new OpenAI({ apiKey: this.config.apiKey, maxRetries: 0 });
    }
    return this.client;
  }

  getCapabilities(): ImageProviderCapabilities {
    return {
      supportsEditing: true,
      maxReferenceImages: OPENAI_MAX_REFERENCES,
      nativeAspects: IMAGE_ASPECTS,
      negativePrompt: false,
      maxImagesPerRequest: 1,
      async: false,
      resolution: `chất lượng ${this.config.quality}`,
      pricePerImageUsd: this.config.pricePerImageUsd,
      pricingSource:
        this.config.pricePerImageUsd === null
          ? 'Chưa cấu hình OPENAI_IMAGE_PRICE_PER_IMAGE_USD – không thể ước tính'
          : 'Đơn giá do quản trị viên cấu hình (OPENAI_IMAGE_PRICE_PER_IMAGE_USD) – ước tính',
      notes: ['Sử dụng theo chính sách sử dụng của OpenAI.'],
    };
  }

  protected async callProvider(req: ImageProviderRequest): Promise<ImageProviderOutput> {
    const client = this.getClient();
    let res;
    try {
      const images = await Promise.all(
        req.references.map((r, i) =>
          toFile(r.data, `reference-${i + 1}.${r.mimeType === 'image/png' ? 'png' : 'jpg'}`, {
            type: r.mimeType,
          }),
        ),
      );
      res = await client.images.edit(
        {
          model: req.model,
          image: images,
          prompt: req.prompt,
          size: OPENAI_SIZES[req.aspect],
          quality: this.config.quality,
          n: 1,
          output_format: 'png',
        },
        { timeout: req.timeoutMs, signal: req.signal },
      );
    } catch (error) {
      throw mapOpenAIError(error);
    }
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new ProviderCallError('refusal', 'Model không trả về ảnh');
    return {
      data: Buffer.from(b64, 'base64'),
      mimeType: 'image/png',
      model: req.model,
      usage: {
        inputTokens: res.usage?.input_tokens ?? null,
        outputTokens: res.usage?.output_tokens ?? null,
      },
      note: null,
      providerRequestId: null,
    };
  }

  async validateConfiguration(model: string): Promise<ProviderHealth> {
    if (!this.isConfigured()) return { available: false, message: 'Chưa cấu hình OPENAI_API_KEY' };
    if (!model) return { available: false, message: 'Chưa cấu hình OPENAI_IMAGE_MODEL' };
    try {
      const info = await this.getClient().models.retrieve(model, { timeout: 15_000 });
      return { available: true, message: `Kết nối thành công – model ${info.id}` };
    } catch (error) {
      const e = mapOpenAIError(error);
      return {
        available: false,
        message:
          e.kind === 'auth'
            ? 'API key không hợp lệ hoặc không có quyền'
            : e.status === 404
              ? `Model "${model}" không tồn tại hoặc tài khoản không được dùng`
              : 'Kiểm tra thất bại',
      };
    }
  }
}
