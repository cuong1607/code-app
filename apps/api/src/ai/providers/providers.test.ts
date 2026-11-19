import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { AppError, type ProviderAttemptRecord, type ScriptGenerationInput } from '@acs/shared';
import { toProductFacts } from '../script/product-facts';
import { SCRIPT_ANGLES, findTemplate } from '../script/templates';
import type { ProviderRuntimeConfig } from './base-script-provider';
import {
  ClaudeScriptProvider,
  type ClaudeClientLike,
  mapAnthropicError,
} from './claude-script-provider';
import { MOCK_MODEL, MockScriptProvider } from './mock-script-provider';
import { OpenAIScriptProvider, type OpenAIClientLike } from './openai-script-provider';
import { ProviderCallError, toAppError } from './provider-error';
import { backoffDelay, withRetry } from './retry';

const runtime: ProviderRuntimeConfig = {
  retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 },
  maxRepairAttempts: 1,
  maxOutputTokens: 4000,
  timeoutMs: 5000,
};

function input(overrides: Partial<ScriptGenerationInput> = {}): ScriptGenerationInput {
  return {
    facts: toProductFacts(
      {
        name: 'Bình giữ nhiệt',
        sku: 'BGN-1',
        category: 'Gia dụng',
        brand: null,
        description: 'Bình inox giữ nhiệt',
        sellingPrice: '250000',
        currency: 'VND',
        attributes: { 'Dung tích': '500 ml', 'Chất liệu': 'Inox 304' },
        sourceUrl: null,
        imageCount: 1,
      },
      { includePrice: false },
    ),
    comparison: [],
    template: findTemplate('tiktok_sales')!,
    brief: {
      durationSeconds: 30,
      audience: 'a',
      tone: 't',
      hookStyle: 'h',
      ctaStyle: 'c',
      customInstructions: '',
      includePrice: false,
      language: 'vi-VN',
    },
    angle: SCRIPT_ANGLES[0]!,
    variant: { index: 1, total: 1, avoidHooks: [] },
    ...overrides,
  };
}

const opts = (records: ProviderAttemptRecord[] = []) => ({
  model: MOCK_MODEL,
  onAttempt: (r: ProviderAttemptRecord) => {
    records.push(r);
  },
});

describe('Retry policy', () => {
  it('retry lỗi tạm thời tới giới hạn rồi ném lỗi', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderCallError('rate_limit', 'x', 429));
    await expect(
      withRetry(fn, runtime.retry, { sleepFn: () => Promise.resolve() }),
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 lần thử lại
  });

  it('không retry lỗi xác thực / request sai', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderCallError('auth', 'x', 401));
    await expect(
      withRetry(fn, runtime.retry, { sleepFn: () => Promise.resolve() }),
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('backoff tăng dần và có trần', () => {
    const p = { maxRetries: 5, baseDelayMs: 1000, maxDelayMs: 5000 };
    expect(backoffDelay(0, p, () => 0.5)).toBe(1000);
    expect(backoffDelay(1, p, () => 0.5)).toBe(2000);
    expect(backoffDelay(10, p, () => 0.5)).toBe(5000);
  });
});

describe('MockScriptProvider + BaseScriptProvider', () => {
  it('tạo kịch bản hợp lệ, có nhãn MOCK, narration = ghép lời thoại', async () => {
    const p = new MockScriptProvider(runtime);
    const out = await p.generateScript(input(), opts());
    expect(out.document.title).toContain('[MOCK]');
    expect(out.document.narration).toBe(out.document.scenes.map((s) => s.spokenText).join(' '));
    expect(out.document.scenes[0]!.sceneType).toBe('HOOK');
    expect(out.document.language).toBe('vi-VN');
    expect(out.attempts).toBe(1);
  });

  it('JSON sai -> yêu cầu AI sửa (1 lần) rồi thành công; ghi nhận mỗi lần gọi', async () => {
    const p = new MockScriptProvider(runtime);
    p.behaviors = ['invalid_json'];
    const records: ProviderAttemptRecord[] = [];
    const out = await p.generateScript(input(), opts(records));
    expect(out.attempts).toBe(2);
    expect(records.map((r) => r.status)).toEqual(['invalid_output', 'success']);
    // Lần 2 có tin nhắn sửa lỗi
    expect(p.requests[1]!.messages).toHaveLength(3);
    expect(p.requests[1]!.messages[2]!.content).toContain('chưa đạt yêu cầu');
  });

  it('sai cấu trúc quá số lần sửa -> invalid_output, không gọi vô hạn', async () => {
    const p = new MockScriptProvider(runtime);
    p.behaviors = ['invalid_schema', 'invalid_schema', 'invalid_schema'];
    await expect(p.generateScript(input(), opts())).rejects.toMatchObject({
      kind: 'invalid_output',
    });
    expect(p.requests).toHaveLength(2);
  });

  it('429 -> retry rồi thành công', async () => {
    const p = new MockScriptProvider(runtime);
    p.behaviors = ['rate_limit'];
    const records: ProviderAttemptRecord[] = [];
    await p.generateScript(input(), opts(records));
    expect(records.map((r) => r.status)).toEqual(['failed', 'success']);
  });

  it('model từ chối -> lỗi refusal (không retry)', async () => {
    const p = new MockScriptProvider(runtime);
    p.behaviors = ['refusal'];
    await expect(p.generateScript(input(), opts())).rejects.toMatchObject({ kind: 'refusal' });
    expect(p.requests).toHaveLength(1);
  });

  it('biến thể: một bản lỗi không làm mất các bản thành công', async () => {
    const p = new MockScriptProvider(runtime);
    p.behaviors = ['ok', 'refusal'];
    const inputs = [0, 1, 2].map((i) =>
      input({ angle: SCRIPT_ANGLES[i]!, variant: { index: i + 1, total: 3, avoidHooks: [] } }),
    );
    const res = await p.generateVariations(inputs, { ...opts(), concurrency: 1 });
    expect(res.map((r) => r.ok)).toEqual([true, false, true]);
    // Biến thể sau được báo hook của biến thể trước để tránh lặp
    expect(p.requests.at(-1)!.messages[0]!.content).toContain('Không dùng lại các hook');
  });

  it('chưa cấu hình -> not_configured', async () => {
    const p = new ClaudeScriptProvider({ ...runtime, effort: 'medium' });
    await expect(p.generateScript(input(), { model: 'claude-opus-5-5' })).rejects.toMatchObject({
      kind: 'not_configured',
    });
    expect((await p.validateConfiguration('claude-opus-5-5')).available).toBe(false);
  });
});

describe('ClaudeScriptProvider (client giả – không gọi API thật)', () => {
  it('gửi structured outputs + fallback, đọc text sau khối fallback, usage, model thực tế', async () => {
    // Lấy JSON hợp lệ từ mock
    const m = new MockScriptProvider(runtime);
    const spy = vi.spyOn(
      m as unknown as { complete: (r: unknown) => Promise<{ text: string }> },
      'complete',
    );
    await m.generateScript(input(), opts());
    const text = (await spy.mock.results[0]!.value).text;

    const create = vi.fn().mockResolvedValue({
      model: 'claude-opus-4-8',
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'bị từ chối giữa chừng' },
        { type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-4-8' } },
        { type: 'text', text },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 900,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: 0,
      },
    });
    const client = {
      beta: { messages: { create } },
      models: { retrieve: vi.fn() },
    } as unknown as ClaudeClientLike;
    const p = new ClaudeScriptProvider({ ...runtime, effort: 'medium' }, () => client);
    const out = await p.generateScript(input(), { model: 'claude-opus-5-5' });
    expect(out.model).toBe('claude-opus-4-8');
    expect(out.usage).toEqual({ inputTokens: 1000, outputTokens: 900 });
    const params = create.mock.calls[0]![0];
    expect(params.output_config.format.type).toBe('json_schema');
    expect(params.output_config.effort).toBe('medium');
    expect(params.fallbacks).toBe('default');
    expect(params).not.toHaveProperty('temperature');
    expect(params.system).toContain('QUY TẮC BẮT BUỘC');
  });

  it('stop_reason refusal -> lỗi refusal', async () => {
    const create = vi.fn().mockResolvedValue({
      model: 'claude-opus-5-5',
      stop_reason: 'refusal',
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });
    const client = {
      beta: { messages: { create } },
      models: { retrieve: vi.fn() },
    } as unknown as ClaudeClientLike;
    const p = new ClaudeScriptProvider({ ...runtime, effort: 'low' }, () => client);
    await expect(p.generateScript(input(), { model: 'claude-opus-5-5' })).rejects.toMatchObject({
      kind: 'refusal',
    });
  });

  it('phân loại lỗi SDK theo lớp lỗi', () => {
    const h = new Headers();
    expect(mapAnthropicError(Anthropic.APIError.generate(401, {}, 'x', h)).kind).toBe('auth');
    expect(mapAnthropicError(Anthropic.APIError.generate(429, {}, 'x', h)).kind).toBe('rate_limit');
    expect(mapAnthropicError(Anthropic.APIError.generate(529, {}, 'x', h)).kind).toBe('overloaded');
    expect(mapAnthropicError(Anthropic.APIError.generate(400, {}, 'x', h)).kind).toBe(
      'bad_request',
    );
    expect(mapAnthropicError(new Anthropic.APIConnectionError({ message: 'x' })).kind).toBe(
      'network',
    );
  });

  it('validateConfiguration dùng Models API, báo lỗi key rõ ràng', async () => {
    const retrieve = vi
      .fn()
      .mockRejectedValue(Anthropic.APIError.generate(401, {}, 'bad', new Headers()));
    const client = {
      beta: { messages: { create: vi.fn() } },
      models: { retrieve },
    } as unknown as ClaudeClientLike;
    const p = new ClaudeScriptProvider({ ...runtime, effort: 'medium' }, () => client);
    const h = await p.validateConfiguration('claude-opus-5-5');
    expect(h.available).toBe(false);
    expect(h.message).toMatch(/API key/);
  });
});

describe('OpenAIScriptProvider (client giả)', () => {
  it('dùng Responses API strict json_schema, store=false, không gửi temperature khi không hỗ trợ', async () => {
    const m = new MockScriptProvider(runtime);
    const spy = vi.spyOn(
      m as unknown as { complete: (r: unknown) => Promise<{ text: string }> },
      'complete',
    );
    await m.generateScript(input(), opts());
    const text = (await spy.mock.results[0]!.value).text;
    const create = vi.fn().mockResolvedValue({
      model: 'gpt-test',
      status: 'completed',
      incomplete_details: null,
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
      output_text: text,
      usage: { input_tokens: 500, output_tokens: 700 },
    });
    const client = {
      responses: { create },
      models: { retrieve: vi.fn() },
    } as unknown as OpenAIClientLike;
    const p = new OpenAIScriptProvider({ ...runtime, supportsTemperature: false }, () => client);
    const out = await p.generateScript(input(), { model: 'gpt-test', temperature: 0.7 });
    const params = create.mock.calls[0]![0];
    expect(params.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(params.store).toBe(false);
    expect(params).not.toHaveProperty('temperature');
    expect(out.usage).toEqual({ inputTokens: 500, outputTokens: 700 });
  });

  it('incomplete max_output_tokens -> truncated', async () => {
    const create = vi.fn().mockResolvedValue({
      model: 'gpt-test',
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
      output_text: '{"title":',
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const client = {
      responses: { create },
      models: { retrieve: vi.fn() },
    } as unknown as OpenAIClientLike;
    const p = new OpenAIScriptProvider({ ...runtime, supportsTemperature: true }, () => client);
    await expect(p.generateScript(input(), { model: 'gpt-test' })).rejects.toMatchObject({
      kind: 'truncated',
    });
  });

  it('lỗi SDK OpenAI 401 -> PROVIDER_NOT_CONFIGURED cho client', async () => {
    const create = vi
      .fn()
      .mockRejectedValue(OpenAI.APIError.generate(401, {}, 'bad key sk-secret', new Headers()));
    const client = {
      responses: { create },
      models: { retrieve: vi.fn() },
    } as unknown as OpenAIClientLike;
    const p = new OpenAIScriptProvider({ ...runtime, supportsTemperature: false }, () => client);
    const err = await p.generateScript(input(), { model: 'gpt-test' }).catch((e: unknown) => e);
    const app = toAppError(err);
    expect(app).toBeInstanceOf(AppError);
    expect(app.code).toBe('PROVIDER_NOT_CONFIGURED');
    // Không lộ chi tiết thô (có thể chứa key) ra client
    expect(JSON.stringify({ m: app.message, d: app.details })).not.toContain('sk-secret');
  });
});
