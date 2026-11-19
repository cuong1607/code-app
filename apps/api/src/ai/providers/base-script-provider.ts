import type {
  CaptionGenerationInput,
  CaptionGenerationOutput,
  ProviderHealth,
  ProviderInfo,
  ProviderUsage,
  SceneRegenerationInput,
  SceneRegenerationOutput,
  ScriptCallOptions,
  ScriptGenerationInput,
  ScriptGenerationOutput,
  ScriptIssue,
  ScriptProvider,
  VariationOutcome,
} from '@acs/shared';
import {
  buildCaptionPrompt,
  buildRepairMessage,
  buildScenePrompt,
  buildScriptPrompt,
} from '../script/prompt-builder';
import {
  CAPTION_OUTPUT_JSON_SCHEMA,
  SCENE_OUTPUT_JSON_SCHEMA,
  SCRIPT_OUTPUT_JSON_SCHEMA,
} from '../script/output-schema';
import {
  type LintContext,
  type ValidationResult,
  parseJsonText,
  validateCaptionOutput,
  validateSceneOutput,
  validateScriptOutput,
} from '../script/script-validation';
import { ProviderCallError } from './provider-error';
import { type RetryPolicy, withRetry } from './retry';

export type CompletionTask = 'script' | 'scene' | 'caption';

export interface CompletionRequest {
  task: CompletionTask;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  schemaName: string;
  schema: Record<string, unknown>;
  model: string;
  temperature?: number;
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Ngữ cảnh có cấu trúc – CHỈ MockScriptProvider dùng (provider thật chỉ đọc prompt) */
  context: ScriptGenerationInput | SceneRegenerationInput | CaptionGenerationInput;
}

export interface CompletionResponse {
  text: string;
  /** Model thực sự trả lời */
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  stopReason: 'end' | 'max_tokens' | 'refusal' | 'other';
}

export interface ProviderRuntimeConfig {
  retry: RetryPolicy;
  maxRepairAttempts: number;
  maxOutputTokens: number;
  timeoutMs: number;
  /** Cổng giới hạn số lời gọi đồng thời toàn API (Semaphore.run) */
  gate?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const addUsage = (a: ProviderUsage, b: { inputTokens: number; outputTokens: number }) => ({
  inputTokens: (a.inputTokens ?? 0) + b.inputTokens,
  outputTokens: (a.outputTokens ?? 0) + b.outputTokens,
});

/** Lấy ngữ cảnh lint từ input (giá thật chỉ có khi includePrice). */
function lintCtx(
  brief: { includePrice: boolean },
  facts: { sellingPrice: string | null },
  speechSpeed = 1,
): LintContext {
  return {
    includePrice: brief.includePrice,
    sellingPriceDigits: facts.sellingPrice ? facts.sellingPrice.replace(/\D/g, '') : null,
    speechSpeed,
  };
}

/**
 * Lớp cơ sở: dựng prompt, gọi `complete()` (do adapter triển khai), kiểm tra JSON,
 * yêu cầu AI sửa khi sai (giới hạn số lần), retry lỗi tạm thời (giới hạn số lần).
 */
export abstract class BaseScriptProvider implements ScriptProvider {
  abstract readonly info: ProviderInfo;
  abstract readonly isMock: boolean;

  constructor(protected readonly runtime: ProviderRuntimeConfig) {}

  /** Một lời gọi API. Ném ProviderCallError đã phân loại. */
  protected abstract complete(req: CompletionRequest): Promise<CompletionResponse>;
  abstract isConfigured(): boolean;
  abstract validateConfiguration(model: string): Promise<ProviderHealth>;

  async checkHealth(): Promise<ProviderHealth> {
    return this.isConfigured()
      ? { available: true }
      : { available: false, message: 'Chưa cấu hình' };
  }

  private async runStructured<T>(
    base: Omit<
      CompletionRequest,
      'messages' | 'maxOutputTokens' | 'timeoutMs' | 'model' | 'temperature' | 'signal'
    > & {
      user: string;
    },
    validate: (raw: unknown) => ValidationResult<T>,
    options: ScriptCallOptions,
  ): Promise<{
    value: T;
    issues: ScriptIssue[];
    meta: { model: string; usage: ProviderUsage; attempts: number; latencyMs: number };
  }> {
    if (!this.isConfigured()) throw new ProviderCallError('not_configured', 'Chưa cấu hình');
    const messages: CompletionRequest['messages'] = [{ role: 'user', content: base.user }];
    let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };
    let attempts = 0;
    let lastModel = options.model;
    const started = Date.now();

    for (let repair = 0; ; repair += 1) {
      let callLatency = 0;
      const res = await withRetry(
        async () => {
          const t0 = Date.now();
          attempts += 1;
          try {
            const gate = this.runtime.gate ?? (<R>(fn: () => Promise<R>) => fn());
            const r = await gate(() =>
              this.complete({
                task: base.task,
                system: base.system,
                messages: [...messages],
                schemaName: base.schemaName,
                schema: base.schema,
                context: base.context,
                model: options.model,
                ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
                maxOutputTokens: this.runtime.maxOutputTokens,
                timeoutMs: options.timeoutMs ?? this.runtime.timeoutMs,
                signal: options.signal,
              }),
            );
            callLatency = Date.now() - t0;
            return r;
          } catch (error) {
            await options.onAttempt?.({
              model: options.model,
              usage: {},
              latencyMs: Date.now() - t0,
              status: 'failed',
              errorCode: error instanceof ProviderCallError ? error.kind : 'unknown',
            });
            throw error;
          }
        },
        this.runtime.retry,
        { signal: options.signal },
      );
      usage = addUsage(usage, res.usage);
      lastModel = res.model;
      const record = (status: 'success' | 'invalid_output' | 'refused', errorCode?: string) =>
        options.onAttempt?.({
          model: res.model,
          usage: res.usage,
          latencyMs: callLatency,
          status,
          ...(errorCode ? { errorCode } : {}),
        });

      if (res.stopReason === 'refusal') {
        await record('refused', 'refusal');
        throw new ProviderCallError('refusal', 'Model từ chối');
      }
      if (res.stopReason === 'max_tokens') {
        await record('invalid_output', 'truncated');
        throw new ProviderCallError('truncated', 'Vượt giới hạn token');
      }
      const json = parseJsonText(res.text);
      const result: ValidationResult<T> = json.ok
        ? validate(json.value)
        : { ok: false, errors: [{ path: '', message: json.message }] };
      if (result.ok) {
        await record('success');
        return {
          value: result.value,
          issues: result.issues,
          meta: { model: lastModel, usage, attempts, latencyMs: Date.now() - started },
        };
      }
      await record('invalid_output', 'invalid_output');
      if (repair >= this.runtime.maxRepairAttempts)
        throw new ProviderCallError(
          'invalid_output',
          'Output không hợp lệ',
          undefined,
          result.errors,
        );
      messages.push(
        { role: 'assistant', content: res.text.slice(0, 20_000) },
        { role: 'user', content: buildRepairMessage(result.errors) },
      );
    }
  }

  async generateScript(
    input: ScriptGenerationInput,
    options: ScriptCallOptions,
  ): Promise<ScriptGenerationOutput> {
    const prompt = buildScriptPrompt(input);
    const ctx = lintCtx(input.brief, input.facts);
    const { value, meta, issues } = await this.runStructured(
      {
        task: 'script',
        system: prompt.system,
        user: prompt.user,
        schemaName: 'video_script',
        schema: SCRIPT_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        context: input,
      },
      (raw) =>
        validateScriptOutput(
          raw,
          { style: input.template.name, targetDurationSeconds: input.brief.durationSeconds },
          ctx,
        ),
      options,
    );
    return { document: value, issues, ...meta };
  }

  async generateVariations(
    inputs: ScriptGenerationInput[],
    options: ScriptCallOptions & { concurrency: number },
  ): Promise<VariationOutcome[]> {
    const results: VariationOutcome[] = new Array(inputs.length);
    const doneHooks: string[] = [];
    let next = 0;
    const worker = async () => {
      while (next < inputs.length) {
        const i = next++;
        const input = inputs[i]!;
        // Báo cho AI các hook đã có để tránh lặp lại
        const withAvoid: ScriptGenerationInput = {
          ...input,
          variant: { ...input.variant, avoidHooks: [...doneHooks].slice(-9) },
        };
        try {
          const output = await this.generateScript(withAvoid, {
            ...options,
            onAttempt: (r) => options.onAttempt?.({ ...r, variantIndex: i }),
          });
          doneHooks.push(output.document.hook);
          results[i] = { ok: true, angle: input.angle, output };
        } catch (error) {
          results[i] = { ok: false, angle: input.angle, error };
        }
      }
    };
    const n = Math.max(1, Math.min(options.concurrency, inputs.length));
    await Promise.all(Array.from({ length: n }, worker));
    return results;
  }

  async regenerateScene(
    input: SceneRegenerationInput,
    options: ScriptCallOptions,
  ): Promise<SceneRegenerationOutput> {
    const prompt = buildScenePrompt(input);
    const ctx = lintCtx(input.brief, input.facts);
    const { value, meta, issues } = await this.runStructured(
      {
        task: 'scene',
        system: prompt.system,
        user: prompt.user,
        schemaName: 'video_scene',
        schema: SCENE_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        context: input,
      },
      (raw) => validateSceneOutput(raw, input.document, input.sceneIndex, ctx),
      options,
    );
    return { scene: value, issues, ...meta };
  }

  async generateCaption(
    input: CaptionGenerationInput,
    options: ScriptCallOptions,
  ): Promise<CaptionGenerationOutput> {
    const prompt = buildCaptionPrompt(input);
    const ctx = lintCtx(input.brief, input.facts);
    const { value, meta } = await this.runStructured(
      {
        task: 'caption',
        system: prompt.system,
        user: prompt.user,
        schemaName: 'video_caption',
        schema: CAPTION_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown>,
        context: input,
      },
      (raw) => validateCaptionOutput(raw, input.document, ctx),
      options,
    );
    return { result: value, ...meta };
  }
}
