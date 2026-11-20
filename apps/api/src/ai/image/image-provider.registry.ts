import { Inject, Injectable } from '@nestjs/common';
import {
  type ApiEnv,
  AppError,
  IMAGE_PROVIDER_IDS,
  type ImageProviderId,
  type ImageProviderModel,
  type ImageProviderStatus,
} from '@acs/shared';
import { APP_ENV } from '../../config/app-config.module';
import { GEMINI_IMAGE_MODELS, openaiPricePerImage } from './image-pricing';
import type { BaseImageProvider } from './providers/base-image-provider';
import { GeminiImageProvider } from './providers/gemini-image-provider';
import { MOCK_IMAGE_MODEL, MockImageProvider } from './providers/mock-image-provider';
import { OpenAIImageProvider } from './providers/openai-image-provider';

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const ENV_VARS: Record<ImageProviderId, string[]> = {
  gemini: ['GOOGLE_API_KEY', 'GEMINI_IMAGE_MODEL'],
  openai: ['OPENAI_API_KEY', 'OPENAI_IMAGE_MODEL', 'OPENAI_IMAGE_PRICE_PER_IMAGE_USD'],
  mock: ['AI_MOCK_PROVIDER_ENABLED'],
};
const DISPLAY: Record<ImageProviderId, string> = {
  gemini: 'Google Gemini (ảnh)',
  openai: 'OpenAI GPT Image',
  mock: 'Mock (không phải AI)',
};

/** Danh bạ ImageProvider dựng từ env server. Không bao giờ trả API key ra ngoài. */
@Injectable()
export class ImageProviderRegistry {
  private readonly providers = new Map<ImageProviderId, BaseImageProvider>();

  constructor(@Inject(APP_ENV) private readonly env: ApiEnv) {
    this.providers.set(
      'gemini',
      new GeminiImageProvider({ apiKey: env.GOOGLE_API_KEY, imageSize: env.GEMINI_IMAGE_SIZE }),
    );
    this.providers.set(
      'openai',
      new OpenAIImageProvider({
        apiKey: env.OPENAI_API_KEY,
        quality: env.OPENAI_IMAGE_QUALITY,
        pricePerImageUsd: openaiPricePerImage(env),
      }),
    );
    if (env.AI_MOCK_PROVIDER_ENABLED) this.providers.set('mock', new MockImageProvider());
  }

  /** Cho phép test thay provider (vd client giả). */
  override(id: ImageProviderId, provider: BaseImageProvider) {
    this.providers.set(id, provider);
  }

  get(id: ImageProviderId): BaseImageProvider | undefined {
    return this.providers.get(id);
  }

  models(id: ImageProviderId): string[] {
    if (id === 'gemini') {
      return [...new Set([this.env.GEMINI_IMAGE_MODEL, ...list(this.env.GEMINI_IMAGE_MODELS)])];
    }
    if (id === 'openai') {
      const d = this.env.OPENAI_IMAGE_MODEL;
      return [...new Set([...(d ? [d] : []), ...list(this.env.OPENAI_IMAGE_MODELS)])];
    }
    return this.providers.has('mock') ? [MOCK_IMAGE_MODEL] : [];
  }

  defaultModel(id: ImageProviderId): string | null {
    if (id === 'gemini') return this.env.GEMINI_IMAGE_MODEL;
    if (id === 'openai') return this.env.OPENAI_IMAGE_MODEL ?? null;
    return this.providers.has('mock') ? MOCK_IMAGE_MODEL : null;
  }

  private modelInfo(id: ImageProviderId, model: string): ImageProviderModel {
    const p = this.providers.get(id);
    const caps = p?.getCapabilities(model);
    const price = caps?.pricePerImageUsd ?? null;
    return {
      id: model,
      label: id === 'gemini' ? (GEMINI_IMAGE_MODELS[model]?.label ?? model) : model,
      pricePerImageUsd: price === null ? null : price.toFixed(4),
      pricingKnown: price !== null,
      pricingSource: caps?.pricingSource ?? '',
      maxReferenceImages: caps?.maxReferenceImages ?? 0,
      nativeAspects: [...(caps?.nativeAspects ?? [])],
      negativePrompt: caps?.negativePrompt ?? false,
      resolution: caps?.resolution ?? '',
      notes: caps?.notes ?? [],
    };
  }

  status(id: ImageProviderId): ImageProviderStatus {
    const p = this.providers.get(id);
    const base = {
      id,
      displayName: DISPLAY[id],
      isMock: id === 'mock',
      envVars: ENV_VARS[id],
      defaultModel: this.defaultModel(id),
      models: this.models(id).map((m) => this.modelInfo(id, m)),
    };
    if (id === 'mock') {
      return p
        ? {
            ...base,
            status: 'ready',
            message: 'Chỉ để kiểm thử – ảnh có dải chữ MOCK, không phải AI',
          }
        : { ...base, status: 'disabled', message: 'Đã tắt (AI_MOCK_PROVIDER_ENABLED=false)' };
    }
    if (!p?.isConfigured())
      return {
        ...base,
        status: 'not_configured',
        message: `Chưa cấu hình – đặt ${ENV_VARS[id][0]} ở server`,
      };
    if (!base.defaultModel)
      return {
        ...base,
        status: 'not_configured',
        message: `Chưa cấu hình model – đặt ${ENV_VARS[id][1]}`,
      };
    return { ...base, status: 'ready', message: 'Đã có credentials (chưa kiểm tra kết nối)' };
  }

  all(): ImageProviderStatus[] {
    return IMAGE_PROVIDER_IDS.map((id) => this.status(id));
  }

  /** Provider mặc định: cài đặt workspace -> AI_IMAGE_PROVIDER -> provider thật đầu tiên sẵn sàng. */
  resolveDefault(preferred: ImageProviderId | null): ImageProviderId | null {
    const ready = (v: string | null | undefined): v is ImageProviderId =>
      !!v &&
      (IMAGE_PROVIDER_IDS as readonly string[]).includes(v) &&
      this.status(v as ImageProviderId).status === 'ready';
    if (ready(preferred)) return preferred;
    if (ready(this.env.AI_IMAGE_PROVIDER)) return this.env.AI_IMAGE_PROVIDER;
    return IMAGE_PROVIDER_IDS.find((id) => ready(id)) ?? null;
  }

  require(id: ImageProviderId, model?: string | null) {
    const st = this.status(id);
    const provider = this.providers.get(id);
    if (st.status !== 'ready' || !provider)
      throw new AppError('PROVIDER_NOT_CONFIGURED', `${st.displayName}: ${st.message}`, {
        provider: id,
      });
    const chosen = model ?? st.defaultModel!;
    if (!this.models(id).includes(chosen))
      throw new AppError(
        'VALIDATION_ERROR',
        `Model "${chosen}" không nằm trong danh sách được phép của ${st.displayName}`,
        [{ path: 'model', message: 'Model không được phép' }],
      );
    return { provider, model: chosen, capabilities: provider.getCapabilities(chosen) };
  }
}
