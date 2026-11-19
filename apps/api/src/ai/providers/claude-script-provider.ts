import Anthropic from '@anthropic-ai/sdk';
import type { ProviderHealth, ProviderInfo } from '@acs/shared';
import {
  BaseScriptProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderRuntimeConfig,
} from './base-script-provider';
import { ProviderCallError } from './provider-error';

export interface ClaudeProviderConfig extends ProviderRuntimeConfig {
  apiKey?: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/** Phần client mà provider dùng (cho phép thay bằng client giả trong unit test). */
export interface ClaudeClientLike {
  beta: { messages: { create: Anthropic['beta']['messages']['create'] } };
  models: { retrieve: Anthropic['models']['retrieve'] };
}

/** Chuyển lỗi SDK -> ProviderCallError (kiểm tra theo lớp lỗi của SDK, không so chuỗi). */
export function mapAnthropicError(error: unknown): ProviderCallError {
  if (error instanceof ProviderCallError) return error;
  if (error instanceof Anthropic.APIUserAbortError)
    return new ProviderCallError('timeout', 'Request bị huỷ');
  if (error instanceof Anthropic.APIConnectionTimeoutError)
    return new ProviderCallError('timeout', 'Hết thời gian chờ');
  if (error instanceof Anthropic.APIConnectionError)
    return new ProviderCallError('network', 'Lỗi kết nối');
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  )
    return new ProviderCallError('auth', 'Xác thực thất bại', error.status);
  if (error instanceof Anthropic.RateLimitError)
    return new ProviderCallError('rate_limit', 'Bị giới hạn tốc độ', 429);
  if (error instanceof Anthropic.NotFoundError)
    return new ProviderCallError('bad_request', 'Model không tồn tại hoặc không được phép', 404);
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.UnprocessableEntityError
  )
    return new ProviderCallError('bad_request', 'Yêu cầu không hợp lệ', error.status);
  if (error instanceof Anthropic.InternalServerError)
    return new ProviderCallError('overloaded', 'Lỗi phía nhà cung cấp', error.status);
  if (error instanceof Anthropic.APIError)
    return new ProviderCallError('unknown', 'Lỗi API', error.status);
  return new ProviderCallError('unknown', 'Lỗi không xác định');
}

/**
 * ClaudeScriptProvider – Anthropic Messages API chính thức (@anthropic-ai/sdk).
 *  - Structured outputs: output_config.format = json_schema (kết quả vẫn được validate lại bằng Zod).
 *  - Model cấu hình qua ANTHROPIC_SCRIPT_MODEL; effort qua ANTHROPIC_SCRIPT_EFFORT.
 *  - Bật server-side fallback ("default") khi model chính từ chối; model thực tế lấy từ response.model.
 *  - SDK maxRetries = 0: retry do BaseScriptProvider kiểm soát (có giới hạn, có ghi usage).
 *  - Các model Claude hiện hành không nhận temperature -> không gửi.
 */
export class ClaudeScriptProvider extends BaseScriptProvider {
  readonly info: ProviderInfo = {
    id: 'anthropic',
    kind: 'script',
    displayName: 'Anthropic Claude',
  };
  readonly isMock = false;
  private client?: ClaudeClientLike;

  constructor(
    private readonly config: ClaudeProviderConfig,
    clientFactory?: () => ClaudeClientLike,
  ) {
    super(config);
    if (clientFactory) this.client = clientFactory();
  }

  isConfigured(): boolean {
    return Boolean(this.client || this.config.apiKey);
  }

  private getClient(): ClaudeClientLike {
    if (!this.client) {
      if (!this.config.apiKey)
        throw new ProviderCallError('not_configured', 'Thiếu ANTHROPIC_API_KEY');
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        maxRetries: 0,
        timeout: this.config.timeoutMs,
      });
    }
    return this.client;
  }

  protected async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const client = this.getClient();
    let response;
    try {
      response = await client.beta.messages.create(
        {
          model: req.model,
          max_tokens: req.maxOutputTokens,
          system: req.system,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          output_config: {
            effort: this.config.effort,
            format: { type: 'json_schema', schema: req.schema },
          },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { timeout: req.timeoutMs, signal: req.signal },
      );
    } catch (error) {
      throw mapAnthropicError(error);
    }

    // Với fallback, phần trả lời hợp lệ nằm SAU khối "fallback" cuối cùng
    const blocks = response.content;
    let start = 0;
    blocks.forEach((b, i) => {
      if (b.type === 'fallback') start = i + 1;
    });
    const text = blocks
      .slice(start)
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('');
    const stop = response.stop_reason;
    return {
      text,
      model: response.model,
      usage: {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
      stopReason:
        stop === 'refusal'
          ? 'refusal'
          : stop === 'max_tokens' || stop === 'model_context_window_exceeded'
            ? 'max_tokens'
            : stop === 'end_turn'
              ? 'end'
              : 'other',
    };
  }

  /** Kiểm tra key + model bằng Models API (không tốn token). */
  async validateConfiguration(model: string): Promise<ProviderHealth> {
    if (!this.isConfigured())
      return { available: false, message: 'Chưa cấu hình ANTHROPIC_API_KEY' };
    try {
      const info = await this.getClient().models.retrieve(model, undefined, { timeout: 15_000 });
      return {
        available: true,
        message: `Kết nối thành công – model ${info.display_name ?? info.id}`,
      };
    } catch (error) {
      const e = mapAnthropicError(error);
      const reason =
        e.kind === 'auth'
          ? 'API key không hợp lệ hoặc không có quyền'
          : e.status === 404
            ? `Model "${model}" không tồn tại hoặc tài khoản không được dùng`
            : e.kind === 'network' || e.kind === 'timeout'
              ? 'Không kết nối được tới Anthropic'
              : 'Kiểm tra thất bại';
      return { available: false, message: reason };
    }
  }
}
