import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import {
  type ApiEnv,
  AppError,
  type AppPreferences,
  CTA_STYLES,
  HOOK_STYLES,
  type ProviderAttemptRecord,
  type ProviderCheckResult,
  SCRIPT_AUDIENCES,
  SCRIPT_TONES,
  type ScriptBrief,
  type ScriptDetail,
  type ScriptEstimate,
  type ScriptGenerationInput,
  type ScriptGenerationResult,
  type ScriptIssue,
  type ScriptProductFacts,
  type ScriptProviderId,
  type ScriptTemplate,
  buildNarration,
  findOption,
  lintScriptDocument,
  nowUtcIso,
  regenerateSceneRequestSchema,
  scriptGenerateRequestSchema,
  textSimilarity,
  validationStatusOf,
} from '@acs/shared';
import { SlidingWindowRateLimiter } from '../ai/ai-limits';
import { AiUsageService } from '../ai/ai-usage.service';
import { usd } from '../ai/pricing';
import { toAppError } from '../ai/providers/provider-error';
import { ScriptProviderRegistry } from '../ai/script-provider.registry';
import { toProductFacts } from '../ai/script/product-facts';
import { buildScriptPrompt, estimateTokens } from '../ai/script/prompt-builder';
import { SCRIPT_OUTPUT_JSON_SCHEMA } from '../ai/script/output-schema';
import { findTemplate, pickAngles } from '../ai/script/templates';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { documentColumns, readDocument } from './script.mapper';
import { ScriptsService } from './scripts.service';

type GenerateParsed = z.output<typeof scriptGenerateRequestSchema>;
type RegenParsed = z.output<typeof regenerateSceneRequestSchema>;

/** Số token đầu ra DỰ KIẾN cho 1 kịch bản (gồm cả suy luận nội bộ của model) – chỉ để ước tính. */
export const EXPECTED_OUTPUT_TOKENS = { script: 5000, scene: 1500, caption: 1200 } as const;
const SIMILAR_HOOK_THRESHOLD = 0.7;

interface PreparedGeneration {
  prefs: AppPreferences;
  providerId: ScriptProviderId;
  model: string;
  template: ScriptTemplate;
  brief: ScriptBrief;
  inputs: ScriptGenerationInput[];
  estimate: {
    inputTokens: number;
    outputTokens: number;
    cost: number | null;
    maxCost: number | null;
  };
}

/**
 * Điều phối tạo kịch bản bằng AI: kiểm tra -> ước tính chi phí -> giữ ngân sách -> gọi provider
 * -> lưu từng biến thể thành công (biến thể lỗi được báo riêng) -> ghi usage.
 */
@Injectable()
export class ScriptGenerationService {
  private readonly logger = new Logger('ScriptGeneration');
  private readonly limiter: SlidingWindowRateLimiter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ScriptProviderRegistry,
    private readonly usage: AiUsageService,
    private readonly settings: SettingsService,
    private readonly scripts: ScriptsService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {
    this.limiter = new SlidingWindowRateLimiter(env.AI_RATE_LIMIT_PER_MINUTE);
  }

  // ------------------------------------------------------------------ dữ liệu sản phẩm
  private async loadFacts(
    ws: string,
    productId: string,
    includePrice: boolean,
  ): Promise<ScriptProductFacts> {
    const p = await this.prisma.product.findFirst({
      where: { id: productId, workspaceId: ws },
      select: {
        name: true,
        sku: true,
        category: true,
        brand: true,
        description: true,
        sellingPrice: true,
        currency: true,
        attributes: true,
        sourceUrl: true,
        _count: { select: { media: true } },
      },
    });
    if (!p) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm trong workspace');
    return toProductFacts({ ...p, imageCount: p._count.media }, { includePrice });
  }

  private briefFrom(src: {
    durationSeconds: number;
    audienceId: string;
    toneId: string;
    hookStyleId: string;
    ctaStyleId: string;
    customInstructions: string;
    includePrice: boolean;
  }): ScriptBrief {
    return {
      durationSeconds: src.durationSeconds,
      audience: findOption(SCRIPT_AUDIENCES, src.audienceId)?.prompt ?? SCRIPT_AUDIENCES[0].prompt,
      tone: findOption(SCRIPT_TONES, src.toneId)?.prompt ?? SCRIPT_TONES[0].prompt,
      hookStyle: findOption(HOOK_STYLES, src.hookStyleId)?.prompt ?? HOOK_STYLES[0].prompt,
      ctaStyle: findOption(CTA_STYLES, src.ctaStyleId)?.prompt ?? CTA_STYLES[0].prompt,
      customInstructions: src.customInstructions,
      includePrice: src.includePrice,
      language: 'vi-VN',
    };
  }

  private resolveProvider(prefs: AppPreferences, provider?: ScriptProviderId, model?: string) {
    const id = provider ?? this.registry.resolveDefault(prefs.ai.defaultProvider);
    if (!id)
      throw new AppError(
        'PROVIDER_NOT_CONFIGURED',
        'Chưa có nhà cung cấp AI nào được cấu hình ở server (ANTHROPIC_API_KEY hoặc OPENAI_API_KEY)',
      );
    const preferredModel = !model && prefs.ai.defaultProvider === id ? prefs.ai.defaultModel : null;
    return { id, ...this.registry.require(id, model ?? preferredModel) };
  }

  // ------------------------------------------------------------------ chuẩn bị + ước tính
  private async prepare(ws: string, body: GenerateParsed): Promise<PreparedGeneration> {
    const prefs = (await this.settings.get(ws)).preferences;
    if (body.variantCount > prefs.ai.maxVariants)
      throw new AppError(
        'VALIDATION_ERROR',
        `Tối đa ${prefs.ai.maxVariants} phiên bản mỗi lần (xem Cài đặt › AI Models)`,
        [{ path: 'variantCount', message: 'Vượt giới hạn số phiên bản' }],
      );
    const template = findTemplate(body.templateId);
    if (!template)
      throw new AppError('VALIDATION_ERROR', 'Template kịch bản không tồn tại', [
        { path: 'templateId', message: 'Không tồn tại' },
      ]);
    if (template.requires.includes('compareProducts') && !body.compareProductIds.length)
      throw new AppError(
        'VALIDATION_ERROR',
        'Template so sánh cần chọn thêm ít nhất 1 sản phẩm để so sánh',
        [{ path: 'compareProductIds', message: 'Cần sản phẩm so sánh' }],
      );
    if (template.requires.includes('customInstructions') && !body.customInstructions)
      throw new AppError('VALIDATION_ERROR', 'Template tuỳ chỉnh cần nhập yêu cầu bổ sung', [
        { path: 'customInstructions', message: 'Bắt buộc với template tuỳ chỉnh' },
      ]);
    if (body.compareProductIds.includes(body.productId))
      throw new AppError('VALIDATION_ERROR', 'Sản phẩm so sánh phải khác sản phẩm chính', [
        { path: 'compareProductIds', message: 'Trùng sản phẩm chính' },
      ]);

    const { id: providerId, model } = this.resolveProvider(prefs, body.provider, body.model);
    if (body.temperature !== undefined && !this.registry.supportsTemperature(providerId))
      throw new AppError(
        'VALIDATION_ERROR',
        'Model đã chọn không hỗ trợ tham số độ sáng tạo (temperature)',
        [{ path: 'temperature', message: 'Không được hỗ trợ' }],
      );

    const facts = await this.loadFacts(ws, body.productId, body.includePrice);
    const comparison = template.requires.includes('compareProducts')
      ? await Promise.all(
          body.compareProductIds.map((id) => this.loadFacts(ws, id, body.includePrice)),
        )
      : [];
    const brief = this.briefFrom(body);
    const angles = pickAngles(body.variantCount);
    const inputs = angles.map((angle, i): ScriptGenerationInput => ({
      facts,
      comparison,
      template,
      brief,
      angle,
      variant: { index: i + 1, total: angles.length, avoidHooks: [] },
    }));
    return {
      prefs,
      providerId,
      model,
      template,
      brief,
      inputs,
      estimate: this.estimateInputs(providerId, model, inputs),
    };
  }

  private estimateInputs(providerId: string, model: string, inputs: ScriptGenerationInput[]) {
    const schemaTokens = estimateTokens(JSON.stringify(SCRIPT_OUTPUT_JSON_SCHEMA));
    const inputTokens = inputs.reduce((sum, input) => {
      const p = buildScriptPrompt(input);
      // + ~9 hook đã có của các biến thể trước (avoidHooks)
      return (
        sum + estimateTokens(p.system + p.user) + schemaTokens + (input.variant.total > 1 ? 150 : 0)
      );
    }, 0);
    const outputTokens = EXPECTED_OUTPUT_TOKENS.script * inputs.length;
    const cost = this.usage.estimateCost(providerId, model, inputTokens, outputTokens);
    // Trần: mọi lời gọi dùng hết max token + mọi lần sửa (mỗi lần sửa gửi lại cả output trước)
    const calls = inputs.length * (1 + this.env.AI_MAX_REPAIR_ATTEMPTS);
    const maxCost = this.usage.estimateCost(
      providerId,
      model,
      inputTokens * (1 + this.env.AI_MAX_REPAIR_ATTEMPTS) +
        this.env.AI_MAX_REPAIR_ATTEMPTS * this.env.AI_MAX_OUTPUT_TOKENS * inputs.length,
      this.env.AI_MAX_OUTPUT_TOKENS * calls,
    );
    return { inputTokens, outputTokens, cost, maxCost };
  }

  async estimate(ws: string, body: GenerateParsed): Promise<ScriptEstimate> {
    const prep = await this.prepare(ws, body);
    const decision = await this.usage.checkBudget(ws, prep.prefs, prep.estimate.cost);
    return {
      provider: prep.providerId,
      model: prep.model,
      calls: prep.inputs.length,
      estimatedInputTokens: prep.estimate.inputTokens,
      estimatedOutputTokens: prep.estimate.outputTokens,
      estimatedCostUsd: usd(prep.estimate.cost ?? 0),
      maxCostUsd: usd(prep.estimate.maxCost ?? 0),
      pricingKnown: prep.estimate.cost !== null,
      allowed: decision.allowed,
      reason: decision.reason,
      remainingDailyUsd: usd(decision.remainingDailyUsd),
      remainingMonthlyUsd:
        decision.remainingMonthlyUsd === null ? null : usd(decision.remainingMonthlyUsd),
    };
  }

  // ------------------------------------------------------------------ ghi usage
  private usageRecorder(
    ws: string,
    providerId: string,
    feature: 'script_generate' | 'scene_regenerate' | 'caption_generate',
    generationId: string,
  ) {
    const ids = new Map<number, string[]>();
    const all: string[] = [];
    const pending: Promise<unknown>[] = [];
    const onAttempt = (r: ProviderAttemptRecord) => {
      const p = this.usage
        .record(ws, {
          provider: providerId,
          model: r.model,
          feature,
          status: r.status,
          generationId,
          inputTokens: r.usage.inputTokens ?? null,
          outputTokens: r.usage.outputTokens ?? null,
          latencyMs: r.latencyMs,
          errorCode: r.errorCode ?? null,
        })
        .then((id) => {
          all.push(id);
          const k = r.variantIndex ?? 0;
          ids.set(k, [...(ids.get(k) ?? []), id]);
        })
        .catch((e: unknown) => this.logger.warn(`Không ghi được usage: ${String(e)}`));
      pending.push(p);
      return p.then(() => undefined);
    };
    return { onAttempt, ids, all, flush: () => Promise.all(pending) };
  }

  private async rejectBudget(
    ws: string,
    providerId: string,
    model: string,
    feature: 'script_generate' | 'scene_regenerate' | 'caption_generate',
    generationId: string,
    error: unknown,
  ) {
    if (error instanceof AppError && error.code === 'BUDGET_EXCEEDED') {
      await this.usage.record(ws, {
        provider: providerId,
        model,
        feature,
        status: 'rejected_budget',
        generationId,
        errorCode: 'budget',
      });
    }
  }

  // ------------------------------------------------------------------ tạo kịch bản + biến thể
  async generate(ws: string, body: GenerateParsed): Promise<ScriptGenerationResult> {
    const prep = await this.prepare(ws, body);
    const generationId = randomUUID();
    this.limiter.consume(ws, prep.inputs.length);
    let release: () => void;
    try {
      release = await this.usage.reserve(ws, prep.prefs, prep.estimate.cost);
    } catch (error) {
      await this.rejectBudget(
        ws,
        prep.providerId,
        prep.model,
        'script_generate',
        generationId,
        error,
      );
      throw error;
    }
    const { provider } = this.registry.require(prep.providerId, prep.model);
    const rec = this.usageRecorder(ws, prep.providerId, 'script_generate', generationId);
    try {
      const outcomes = await provider.generateVariations(prep.inputs, {
        model: prep.model,
        ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        concurrency: prep.prefs.ai.maxConcurrentRequests,
        correlationId: generationId,
        onAttempt: rec.onAttempt,
      });
      await rec.flush();

      // Phát hiện biến thể na ná nhau (hook gần giống)
      const hooks = outcomes.map((o) => (o.ok ? o.output.document.hook : null));
      const config = {
        durationSeconds: body.durationSeconds,
        audienceId: body.audienceId,
        toneId: body.toneId,
        hookStyleId: body.hookStyleId,
        ctaStyleId: body.ctaStyleId,
        includePrice: body.includePrice,
        customInstructions: body.customInstructions,
        compareProductIds: body.compareProductIds.join(','),
        variantCount: body.variantCount,
        promptBuilderVersion: '1.0.0',
      };
      const items: ScriptGenerationResult['items'] = [];
      let totalIn = 0;
      let totalOut = 0;
      for (let i = 0; i < outcomes.length; i += 1) {
        const o = outcomes[i]!;
        if (!o.ok) {
          const err = toAppError(o.error);
          this.logger.warn(
            `Biến thể ${i + 1}/${outcomes.length} lỗi: [${err.code}] ${err.message}`,
          );
          items.push({
            variantIndex: i + 1,
            angleId: o.angle.id,
            angleLabel: o.angle.label,
            status: 'failed',
            script: null,
            error: { code: err.code, message: err.message },
          });
          continue;
        }
        totalIn += o.output.usage.inputTokens ?? 0;
        totalOut += o.output.usage.outputTokens ?? 0;
        const issues: ScriptIssue[] = [...o.output.issues];
        hooks.forEach((h, j) => {
          if (j < i && h && textSimilarity(h, o.output.document.hook) >= SIMILAR_HOOK_THRESHOLD)
            issues.push({
              severity: 'warning',
              code: 'VARIANT_SIMILAR',
              path: 'hook',
              message: `Hook gần giống phiên bản ${j + 1}`,
            });
        });
        const id = randomUUID();
        await this.prisma.scriptDraft.create({
          data: {
            id,
            rootId: id,
            workspaceId: ws,
            productId: body.productId,
            versionNumber: 1,
            origin: 'ai',
            changeNote: `Tạo bằng AI – ${o.angle.label}`,
            templateId: prep.template.id,
            templateVersion: prep.template.version,
            provider: prep.providerId,
            model: o.output.model,
            ...documentColumns(o.output.document),
            issues: issues as unknown as Prisma.InputJsonValue,
            validationStatus: validationStatusOf(issues),
            variantGroupId: generationId,
            variantIndex: i + 1,
            angleId: o.angle.id,
            isPreferred: i === 0,
            config,
          },
        });
        await this.usage.linkToScript(ws, rec.ids.get(i) ?? [], id);
        const [dto] = await this.scripts.toDtos(ws, [await this.scripts.findOwned(ws, id)]);
        items.push({
          variantIndex: i + 1,
          angleId: o.angle.id,
          angleLabel: o.angle.label,
          status: 'success',
          script: dto!,
          error: null,
        });
      }
      const succeeded = items.filter((x) => x.status === 'success').length;
      if (!succeeded) {
        const first = outcomes.find((o) => !o.ok);
        throw toAppError(first && !first.ok ? first.error : undefined);
      }
      const cost = this.usage.estimateCost(prep.providerId, prep.model, totalIn, totalOut) ?? 0;
      return {
        generationId,
        provider: prep.providerId,
        model: items.find((x) => x.script)?.script?.model ?? prep.model,
        isMock: provider.isMock,
        requested: outcomes.length,
        succeeded,
        failed: outcomes.length - succeeded,
        items,
        usage: {
          calls: rec.all.length,
          inputTokens: totalIn,
          outputTokens: totalOut,
          estimatedCostUsd: usd(cost),
        },
      };
    } finally {
      release();
    }
  }

  // ------------------------------------------------------------------ tạo lại cảnh / caption
  private async contextFor(ws: string, id: string) {
    const row = await this.scripts.findOwned(ws, id);
    if (!row.productId)
      throw new AppError(
        'VALIDATION_ERROR',
        'Kịch bản không gắn sản phẩm nên không thể tạo lại bằng AI (dữ kiện sản phẩm là bắt buộc)',
      );
    const cfg = (row.config ?? {}) as Record<string, unknown>;
    const str = (k: string, d: string) => (typeof cfg[k] === 'string' ? (cfg[k] as string) : d);
    const { document } = readDocument(row);
    const includePrice = cfg.includePrice === true;
    const facts = await this.loadFacts(ws, row.productId, includePrice);
    const brief = this.briefFrom({
      durationSeconds: document.targetDurationSeconds,
      audienceId: str('audienceId', 'general'),
      toneId: str('toneId', 'friendly'),
      hookStyleId: str('hookStyleId', 'question'),
      ctaStyleId: str('ctaStyleId', 'soft'),
      customInstructions: str('customInstructions', ''),
      includePrice,
    });
    const template = findTemplate(row.templateId ?? '') ?? findTemplate('review')!;
    // Phiên bản sửa tay không có provider -> dùng provider của phiên bản AI gần nhất cùng kịch bản
    const aiAncestor = row.provider
      ? null
      : await this.prisma.scriptDraft.findFirst({
          where: { workspaceId: ws, rootId: row.rootId ?? row.id, provider: { not: null } },
          orderBy: { versionNumber: 'desc' },
          select: { provider: true },
        });
    const provider = row.provider ?? aiAncestor?.provider ?? null;
    return { row, document, facts, brief, template, provider };
  }

  private async runSingle<T>(
    ws: string,
    feature: 'scene_regenerate' | 'caption_generate',
    providerPref: { provider?: ScriptProviderId; model?: string },
    rowProvider: string | null,
    expectedOutput: number,
    promptChars: number,
    call: (
      p: ReturnType<ScriptProviderRegistry['require']>['provider'],
      model: string,
      onAttempt: (r: ProviderAttemptRecord) => Promise<void>,
    ) => Promise<T>,
  ): Promise<{ result: T; providerId: ScriptProviderId; usageIds: string[] }> {
    const prefs = (await this.settings.get(ws)).preferences;
    const fromRow =
      rowProvider && rowProvider !== 'manual' ? (rowProvider as ScriptProviderId) : undefined;
    const preferred =
      providerPref.provider ??
      (fromRow && this.registry.status(fromRow).status === 'ready' ? fromRow : undefined);
    const {
      id: providerId,
      model,
      provider,
    } = this.resolveProvider(prefs, preferred, providerPref.model);
    const generationId = randomUUID();
    const estimate = this.usage.estimateCost(
      providerId,
      model,
      Math.ceil(promptChars / 2.5) + 2000,
      expectedOutput,
    );
    this.limiter.consume(ws, 1);
    let release: () => void;
    try {
      release = await this.usage.reserve(ws, prefs, estimate);
    } catch (error) {
      await this.rejectBudget(ws, providerId, model, feature, generationId, error);
      throw error;
    }
    const rec = this.usageRecorder(ws, providerId, feature, generationId);
    try {
      const result = await call(provider, model, rec.onAttempt);
      await rec.flush();
      return { result, providerId, usageIds: rec.all };
    } catch (error) {
      await rec.flush();
      throw toAppError(error);
    } finally {
      release();
    }
  }

  async regenerateScene(
    ws: string,
    id: string,
    sceneIndex: number,
    body: RegenParsed,
  ): Promise<ScriptDetail> {
    const { row, document, facts, brief, template, provider } = await this.contextFor(ws, id);
    if (!document.scenes.some((s) => s.index === sceneIndex))
      throw new AppError('NOT_FOUND', `Kịch bản không có cảnh số ${sceneIndex}`);
    const { result, providerId, usageIds } = await this.runSingle(
      ws,
      'scene_regenerate',
      body,
      provider,
      EXPECTED_OUTPUT_TOKENS.scene,
      JSON.stringify(document).length,
      (p, model, onAttempt) =>
        p.regenerateScene(
          { facts, template, brief, document, sceneIndex, instructions: body.instructions },
          { model, onAttempt },
        ),
    );
    const scenes = document.scenes.map((s) => (s.index === sceneIndex ? result.scene : s));
    const next = { ...document, scenes, narration: buildNarration(scenes) };
    const detail = await this.scripts.createVersion(ws, row.id, {
      document: next,
      issues: result.issues,
      origin: 'ai',
      changeNote: `Tạo lại cảnh ${sceneIndex} bằng AI`,
      provider: providerId,
      model: result.model,
    });
    await this.usage.linkToScript(ws, usageIds, detail.id);
    return this.scripts.detail(ws, detail.id);
  }

  async regenerateCaption(ws: string, id: string, body: RegenParsed): Promise<ScriptDetail> {
    const { row, document, facts, brief, provider } = await this.contextFor(ws, id);
    const { result, providerId, usageIds } = await this.runSingle(
      ws,
      'caption_generate',
      body,
      provider,
      EXPECTED_OUTPUT_TOKENS.caption,
      document.narration.length + 3000,
      (p, model, onAttempt) =>
        p.generateCaption(
          { facts, brief, document, instructions: body.instructions },
          { model, onAttempt },
        ),
    );
    const next = { ...document, ...result.result };
    const detail = await this.scripts.createVersion(ws, row.id, {
      document: next,
      issues: lintScriptDocument(next, { mode: 'manual', includePrice: brief.includePrice }),
      origin: 'ai',
      changeNote: 'Tạo lại caption, hashtag và CTA bằng AI',
      provider: providerId,
      model: result.model,
    });
    await this.usage.linkToScript(ws, usageIds, detail.id);
    return this.scripts.detail(ws, detail.id);
  }

  // ------------------------------------------------------------------ provider
  async checkProvider(
    ws: string,
    id: ScriptProviderId,
    model?: string,
  ): Promise<ProviderCheckResult> {
    const st = this.registry.status(id);
    const provider = this.registry.get(id);
    const chosen = model ?? st.defaultModel;
    if (st.status !== 'ready' || !provider || !chosen)
      return { id, ok: false, message: st.message, model: chosen ?? null, checkedAt: nowUtcIso() };
    this.limiter.consume(ws, 1);
    const t0 = Date.now();
    const health = await provider.validateConfiguration(chosen);
    await this.usage.record(ws, {
      provider: id,
      model: chosen,
      feature: 'provider_check',
      status: health.available ? 'success' : 'failed',
      latencyMs: Date.now() - t0,
      errorCode: health.available ? null : 'check_failed',
    });
    return {
      id,
      ok: health.available,
      message: health.message ?? '',
      model: chosen,
      checkedAt: nowUtcIso(),
    };
  }
}
