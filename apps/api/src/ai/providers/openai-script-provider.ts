import OpenAI from 'openai';
import type { ProviderHealth, ProviderInfo } from '@acs/shared';
import {
  BaseScriptProvider,
  type CompletionRequest,
  type CompletionResponse,
  type ProviderRuntimeConfig,
} from './base-script-provider';
import { ProviderCallError } from './provider-error';

export interface OpenAIProviderConfig extends ProviderRuntimeConfig {
  apiKey?: string;
  supportsTemperature: boolean;
}

export interface OpenAIClientLike {
  responses: { create: OpenAI['responses']['create'] };
  models: { retrieve: OpenAI['models']['retrieve'] };
}

export function mapOpenAIError(error: unknown): ProviderCallError {
  if (error instanceof ProviderCallError) return error;
  if (error instanceof OpenAI.APIUserAbortError)
    return new ProviderCallError('timeout', 'Request bị huỷ');
  if (error instanceof OpenAI.APIConnectionTimeoutError)
    return new ProviderCallError('timeout', 'Hết thời gian chờ');
  if (error instanceof OpenAI.APIConnectionError)
    return new ProviderCallError('network', 'Lỗi kết nối');
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError)
    return new ProviderCallError('auth', 'Xác thực thất bại', error.status);
  if (error instanceof OpenAI.RateLimitError)
    return new ProviderCallError('rate_limit', 'Bị giới hạn tốc độ', 429);
  if (error instanceof OpenAI.NotFoundError)
    return new ProviderCallError('bad_request', 'Model không tồn tại', 404);
  if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.UnprocessableEntityError)
    return new ProviderCallError('bad_request', 'Yêu cầu không hợp lệ', error.status);
  if (error instanceof OpenAI.InternalServerError)
    return new ProviderCallError('overloaded', 'Lỗi phía nhà cung cấp', error.status);
  if (error instanceof OpenAI.APIError)
    return new ProviderCallError('unknown', 'Lỗi API', error.status);
  return new ProviderCallError('unknown', 'Lỗi không xác định');
}

/**
 * OpenAIScriptProvider – OpenAI Responses API chính thức (openai SDK).
 *  - Structured outputs: text.format = json_schema, strict = true.
 *  - Model BẮT BUỘC cấu hình qua OPENAI_SCRIPT_MODEL (không hardcode model ID trong code).
 *  - temperature chỉ gửi khi OPENAI_SUPPORTS_TEMPERATURE=true (nhiều model reasoning không nhận).
 *  - store=false: không lưu hội thoại ở phía OpenAI.
 */
export class OpenAIScriptProvider extends BaseScriptProvider {
  readonly info: ProviderInfo = { id: 'openai', kind: 'script', displayName: 'OpenAI' };
  readonly isMock = false;
  private client?: OpenAIClientLike;

  constructor(
    private readonly config: OpenAIProviderConfig,
    clientFactory?: () => OpenAIClientLike,
  ) {
    super(config);
    if (clientFactory) this.client = clientFactory();
  }

  isConfigured(): boolean {
    return Boolean(this.client || this.config.apiKey);
  }

  private getClient(): OpenAIClientLike {
    if (!this.client) {
      if (!this.config.apiKey)
        throw new ProviderCallError('not_configured', 'Thiếu OPENAI_API_KEY');
      this.client = new OpenAI({
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
      response = await client.responses.create(
        {
          model: req.model,
          instructions: req.system,
          input: req.messages.map((m) => ({ role: m.role, content: m.content })),
          text: {
            format: { type: 'json_schema', name: req.schemaName, schema: req.schema, strict: true },
          },
          max_output_tokens: req.maxOutputTokens,
          store: false,
          ...(this.config.supportsTemperature && req.temperature !== undefined
            ? { temperature: req.temperature }
            : {}),
        },
        { timeout: req.timeoutMs, signal: req.signal },
      );
    } catch (error) {
      throw mapOpenAIError(error);
    }

    const refused = response.output.some(
      (item) => item.type === 'message' && item.content.some((c) => c.type === 'refusal'),
    );
    const reason = response.incomplete_details?.reason;
    return {
      text: response.output_text ?? '',
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
      stopReason:
        refused || reason === 'content_filter'
          ? 'refusal'
          : reason === 'max_output_tokens'
            ? 'max_tokens'
            : response.status === 'completed'
              ? 'end'
              : 'other',
    };
  }

  async validateConfiguration(model: string): Promise<ProviderHealth> {
    if (!this.isConfigured()) return { available: false, message: 'Chưa cấu hình OPENAI_API_KEY' };
    if (!model) return { available: false, message: 'Chưa cấu hình OPENAI_SCRIPT_MODEL' };
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
              : e.kind === 'network' || e.kind === 'timeout'
                ? 'Không kết nối được tới OpenAI'
                : 'Kiểm tra thất bại',
      };
    }
  }
}
