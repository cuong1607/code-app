import { Inject, Injectable } from '@nestjs/common';
import {
  type ApiEnv,
  AppError,
  type ScriptProviderId,
  type ScriptProviderStatus,
  SCRIPT_PROVIDER_IDS,
} from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { Semaphore } from './ai-limits';
import { priceFor } from './pricing';
import type { BaseScriptProvider, ProviderRuntimeConfig } from './providers/base-script-provider';
import { ClaudeScriptProvider } from './providers/claude-script-provider';
import { MockScriptProvider } from './providers/mock-script-provider';
import { OpenAIScriptProvider } from './providers/openai-script-provider';

const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const MODEL_LABELS: Record<string, string> = {
  'claude-opus-5-5': 'Claude Opus 5.5 (chất lượng cao nhất – mặc định)',
  'claude-sonnet-5-5': 'Claude Sonnet 5.5 (cân bằng)',
  'claude-haiku-5-5': 'Claude Haiku 5.5 (nhanh, rẻ)',
  'claude-fable-5-2': 'Claude Fable 5.2 (cao cấp nhất, chi phí cao)',
};

/**
 * Danh bạ ScriptProvider dựng từ biến môi trường server.
 * KHÔNG trả API key ra ngoài – chỉ trạng thái "đã cấu hình / chưa cấu hình".
 */
@Injectable()
export class ScriptProviderRegistry {
  private readonly providers = new Map<ScriptProviderId, BaseScriptProvider>();
  /** Giới hạn số lời gọi AI đồng thời của cả API (AI_MAX_CONCURRENT_REQUESTS) */
  private readonly semaphore: Semaphore;

  constructor(@Inject(APP_ENV) private readonly env: ApiEnv) {
    this.semaphore = new Semaphore(env.AI_MAX_CONCURRENT_REQUESTS);
    const runtime: ProviderRuntimeConfig = {
      retry: { maxRetries: env.AI_MAX_RETRIES, baseDelayMs: 1000, maxDelayMs: 15_000 },
      maxRepairAttempts: env.AI_MAX_REPAIR_ATTEMPTS,
      maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
      timeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      gate: (fn) => this.semaphore.run(fn),
    };
    this.providers.set(
      'anthropic',
      new ClaudeScriptProvider({
        ...runtime,
        apiKey: env.ANTHROPIC_API_KEY,
        effort: env.ANTHROPIC_SCRIPT_EFFORT,
      }),
    );
    this.providers.set(
      'openai',
      new OpenAIScriptProvider({
        ...runtime,
        apiKey: env.OPENAI_API_KEY,
        supportsTemperature: env.OPENAI_SUPPORTS_TEMPERATURE,
      }),
    );
    if (env.AI_MOCK_PROVIDER_ENABLED)
      this.providers.set(
        'mock',
        new MockScriptProvider({ ...runtime, retry: { ...runtime.retry, baseDelayMs: 10 } }),
      );
  }

  /** Cho phép test thay provider (vd Mock có hành vi lỗi). */
  override(id: ScriptProviderId, provider: BaseScriptProvider) {
    this.providers.set(id, provider);
  }

  get(id: ScriptProviderId): BaseScriptProvider | undefined {
    return this.providers.get(id);
  }

  models(id: ScriptProviderId): string[] {
    if (id === 'anthropic') {
      const all = list(this.env.ANTHROPIC_SCRIPT_MODELS);
      return [...new Set([this.env.ANTHROPIC_SCRIPT_MODEL, ...all])];
    }
    if (id === 'openai') {
      const d = this.env.OPENAI_SCRIPT_MODEL;
      return [...new Set([...(d ? [d] : []), ...list(this.env.OPENAI_SCRIPT_MODELS)])];
    }
    return this.providers.has('mock') ? ['mock-script-v1'] : [];
  }

  defaultModel(id: ScriptProviderId): string | null {
    if (id === 'anthropic') return this.env.ANTHROPIC_SCRIPT_MODEL;
    if (id === 'openai') return this.env.OPENAI_SCRIPT_MODEL ?? null;
    return this.providers.has('mock') ? 'mock-script-v1' : null;
  }

  supportsTemperature(id: ScriptProviderId): boolean {
    // Model Claude hiện hành (API 2026-10-21) không nhận temperature/top_p/top_k
    return id === 'openai' ? this.env.OPENAI_SUPPORTS_TEMPERATURE : false;
  }

  status(id: ScriptProviderId): ScriptProviderStatus {
    const p = this.providers.get(id);
    const envVars =
      id === 'anthropic'
        ? ['ANTHROPIC_API_KEY', 'ANTHROPIC_SCRIPT_MODEL']
        : id === 'openai'
          ? [
              'OPENAI_API_KEY',
              'OPENAI_SCRIPT_MODEL',
              'OPENAI_PRICE_INPUT_PER_MTOK',
              'OPENAI_PRICE_OUTPUT_PER_MTOK',
            ]
          : ['AI_MOCK_PROVIDER_ENABLED'];
    const models = this.models(id).map((m) => ({
      id: m,
      label: MODEL_LABELS[m] ?? m,
      supportsTemperature: this.supportsTemperature(id),
      pricingKnown: priceFor(id, m, this.env) !== null,
    }));
    const base = {
      id,
      envVars,
      defaultModel: this.defaultModel(id),
      models,
      isMock: id === 'mock',
    };
    if (id === 'mock') {
      return p
        ? {
            ...base,
            displayName: 'Mock (không phải AI)',
            status: 'ready',
            message: 'Chỉ dùng để kiểm thử – nội dung có nhãn [MOCK]',
          }
        : {
            ...base,
            displayName: 'Mock (không phải AI)',
            status: 'disabled',
            message: 'Đã tắt (AI_MOCK_PROVIDER_ENABLED=false)',
          };
    }
    const displayName = id === 'anthropic' ? 'Anthropic Claude' : 'OpenAI';
    if (!p?.isConfigured())
      return {
        ...base,
        displayName,
        status: 'not_configured',
        message: `Chưa cấu hình – đặt ${envVars[0]} ở server`,
      };
    if (!base.defaultModel)
      return {
        ...base,
        displayName,
        status: 'not_configured',
        message: `Chưa cấu hình model – đặt ${envVars[1]}`,
      };
    return {
      ...base,
      displayName,
      status: 'ready',
      message: 'Đã có credentials (chưa kiểm tra kết nối)',
    };
  }

  all(): ScriptProviderStatus[] {
    return SCRIPT_PROVIDER_IDS.map((id) => this.status(id));
  }

  /** Provider mặc định: cài đặt workspace -> AI_SCRIPT_PROVIDER -> provider đầu tiên sẵn sàng. */
  resolveDefault(preferred: ScriptProviderId | null): ScriptProviderId | null {
    const ready = (id: string | null | undefined): id is ScriptProviderId =>
      !!id &&
      (SCRIPT_PROVIDER_IDS as readonly string[]).includes(id) &&
      this.status(id as ScriptProviderId).status === 'ready';
    if (ready(preferred)) return preferred;
    if (ready(this.env.AI_SCRIPT_PROVIDER)) return this.env.AI_SCRIPT_PROVIDER;
    return SCRIPT_PROVIDER_IDS.find((id) => ready(id)) ?? null;
  }

  /** Lấy provider + model đã kiểm tra; lỗi rõ ràng nếu chưa cấu hình hoặc model không được phép. */
  require(
    id: ScriptProviderId,
    model?: string | null,
  ): { provider: BaseScriptProvider; model: string } {
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
    return { provider, model: chosen };
  }
}
