import { z } from 'zod';
import { PUBLISH_CAPTION_MAX, PUBLISH_MAX_HASHTAGS } from './drafts';

/**
 * AI SCRIPT ENGINE (Phase 03) – schema dùng chung giữa API và web.
 *
 * Tài liệu kịch bản (ScriptDocument v2) là định dạng DUY NHẤT được lưu vào `script_drafts.content`.
 * Bản nháp cũ của Phase 02 (v1) được nâng cấp khi đọc bằng `upgradeScriptContent()` – không ghi đè DB.
 */
export const SCRIPT_LANGUAGE = 'vi-VN' as const;
export const SCRIPT_DOCUMENT_VERSION = 2 as const;

export const SCRIPT_DURATIONS = [15, 20, 30, 45, 60] as const;
export type ScriptDuration = (typeof SCRIPT_DURATIONS)[number];
export const SCRIPT_VARIANT_COUNTS = [1, 3, 5, 10] as const;

export const SCENE_TYPES = [
  'HOOK',
  'PROBLEM',
  'INTRO',
  'FEATURE',
  'DEMO',
  'BENEFIT',
  'STORY',
  'COMPARISON',
  'CTA',
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const VISUAL_SOURCES = [
  'PRODUCT_IMAGE',
  'AI_GENERATED_IMAGE',
  'AI_GENERATED_VIDEO',
  'STOCK_ASSET',
  'CUSTOM_UPLOAD',
] as const;
export type VisualSource = (typeof VISUAL_SOURCES)[number];

export const SCRIPT_PROVIDER_IDS = ['anthropic', 'openai', 'mock'] as const;
export type ScriptProviderId = (typeof SCRIPT_PROVIDER_IDS)[number];

export const SCRIPT_ORIGINS = ['ai', 'manual', 'sample', 'legacy'] as const;
export type ScriptOrigin = (typeof SCRIPT_ORIGINS)[number];

export const SCRIPT_VALIDATION_STATUSES = ['valid', 'warnings', 'invalid', 'unchecked'] as const;
export type ScriptValidationStatus = (typeof SCRIPT_VALIDATION_STATUSES)[number];

// ------------------------------------------------------------------ Tuỳ chọn sáng tạo
export interface CreativeOption {
  id: string;
  label: string;
  /** Mô tả đưa vào prompt (tiếng Việt) */
  prompt: string;
}

export const SCRIPT_AUDIENCES = [
  { id: 'general', label: 'Khách hàng phổ thông', prompt: 'người mua sắm online phổ thông' },
  {
    id: 'gen-z',
    label: 'Gen Z (18–24)',
    prompt: 'Gen Z 18–24 tuổi, thích nội dung nhanh, gần gũi',
  },
  {
    id: 'office',
    label: 'Dân văn phòng (25–35)',
    prompt: 'nhân viên văn phòng 25–35 tuổi, bận rộn, coi trọng tiện lợi',
  },
  { id: 'parents', label: 'Bố mẹ trẻ', prompt: 'bố mẹ trẻ, quan tâm an toàn và tính thực dụng' },
  {
    id: 'premium',
    label: 'Khách hàng cao cấp',
    prompt: 'khách hàng cao cấp, coi trọng chất lượng và thẩm mỹ',
  },
  {
    id: 'students',
    label: 'Học sinh – sinh viên',
    prompt: 'học sinh, sinh viên, quan tâm giá trị sử dụng',
  },
] as const satisfies readonly CreativeOption[];

export const SCRIPT_TONES = [
  {
    id: 'friendly',
    label: 'Thân thiện, gần gũi',
    prompt: 'thân thiện, gần gũi như đang trò chuyện',
  },
  {
    id: 'energetic',
    label: 'Năng động, hào hứng',
    prompt: 'năng động, nhịp nhanh nhưng không la hét',
  },
  { id: 'premium', label: 'Sang trọng, tinh tế', prompt: 'sang trọng, tinh tế, câu chữ chọn lọc' },
  {
    id: 'humorous',
    label: 'Hài hước nhẹ nhàng',
    prompt: 'hài hước nhẹ nhàng, không châm biếm, không phản cảm',
  },
  {
    id: 'expert',
    label: 'Chuyên gia, tin cậy',
    prompt: 'điềm tĩnh, rõ ràng như người am hiểu sản phẩm',
  },
] as const satisfies readonly CreativeOption[];

export const HOOK_STYLES = [
  {
    id: 'question',
    label: 'Câu hỏi gợi tò mò',
    prompt: 'mở đầu bằng một câu hỏi chạm đúng nhu cầu người xem',
  },
  {
    id: 'problem',
    label: 'Nêu vấn đề',
    prompt: 'mở đầu bằng một vấn đề thường gặp mà sản phẩm giải quyết',
  },
  {
    id: 'bold',
    label: 'Nhận định ấn tượng',
    prompt: 'mở đầu bằng một nhận định ngắn, ấn tượng nhưng ĐÚNG sự thật',
  },
  {
    id: 'visual',
    label: 'Hình ảnh bất ngờ',
    prompt: 'mở đầu bằng một khoảnh khắc hình ảnh bắt mắt kèm câu nói ngắn',
  },
  {
    id: 'scenario',
    label: 'Tình huống đời thường',
    prompt: 'mở đầu bằng một tình huống đời thường dễ đồng cảm',
  },
] as const satisfies readonly CreativeOption[];

export const CTA_STYLES = [
  { id: 'soft', label: 'Nhẹ nhàng', prompt: 'mời người xem tìm hiểu thêm, không thúc ép' },
  { id: 'direct', label: 'Trực tiếp', prompt: 'kêu gọi xem chi tiết và đặt hàng rõ ràng' },
  { id: 'engage', label: 'Tương tác', prompt: 'mời người xem bình luận hoặc lưu video' },
  {
    id: 'follow',
    label: 'Theo dõi kênh',
    prompt: 'mời người xem theo dõi kênh để xem thêm sản phẩm',
  },
] as const satisfies readonly CreativeOption[];

const ids = <T extends readonly { id: string }[]>(list: T) =>
  list.map((o) => o.id) as unknown as [T[number]['id'], ...T[number]['id'][]];

export const findOption = <T extends readonly CreativeOption[]>(list: T, id: string) =>
  list.find((o) => o.id === id);

// ------------------------------------------------------------------ Tài liệu kịch bản v2
const HASHTAG_RE = /^#[\p{L}\p{N}_]{1,60}$/u;

export const scriptSceneSchema = z
  .object({
    index: z.number().int().min(1).max(30),
    sceneType: z.enum(SCENE_TYPES),
    durationHintSeconds: z.number().min(0.5, 'Thời lượng cảnh tối thiểu 0,5 giây').max(30),
    description: z.string().trim().max(500),
    visualPrompt: z.string().trim().max(1500),
    spokenText: z.string().trim().min(1, 'Lời thoại cảnh không được rỗng').max(600),
    overlayText: z.string().trim().max(120),
    visualSource: z.enum(VISUAL_SOURCES),
  })
  .strict();
export type ScriptScene = z.infer<typeof scriptSceneSchema>;

export const scriptDocumentSchema = z
  .object({
    schemaVersion: z.literal(SCRIPT_DOCUMENT_VERSION),
    language: z.literal(SCRIPT_LANGUAGE),
    title: z.string().trim().min(1, 'Thiếu tiêu đề').max(200),
    style: z.string().trim().max(60),
    targetDurationSeconds: z.number().int().min(5).max(180),
    hook: z.string().trim().max(300),
    /** Toàn bộ lời thoại = ghép spokenText các cảnh (server tự tính lại, xem buildNarration) */
    narration: z.string().max(12_000),
    scenes: z.array(scriptSceneSchema).min(1, 'Cần ít nhất 1 cảnh').max(30, 'Tối đa 30 cảnh'),
    caption: z.string().trim().max(PUBLISH_CAPTION_MAX),
    hashtags: z
      .array(z.string().regex(HASHTAG_RE, 'Hashtag phải dạng #tukhoa, không dấu cách'))
      .max(PUBLISH_MAX_HASHTAGS),
    cta: z.string().trim().max(300),
    complianceFlags: z.array(z.string().max(300)).max(30),
  })
  .strict();
export type ScriptDocument = z.infer<typeof scriptDocumentSchema>;

/** Ghép lời thoại từng cảnh -> narration (nguồn duy nhất cho TTS). */
export function buildNarration(scenes: Pick<ScriptScene, 'spokenText'>[]): string {
  return scenes
    .map((s) => s.spokenText.trim())
    .filter(Boolean)
    .join(' ');
}

/** Đánh lại số thứ tự cảnh theo vị trí + tính lại narration. */
export function normalizeScriptDocument(doc: ScriptDocument): ScriptDocument {
  const scenes = doc.scenes.map((s, i) => ({ ...s, index: i + 1 }));
  return { ...doc, scenes, narration: buildNarration(scenes) };
}

// ------------------------------------------------------------------ Tương thích Phase 02 (v1)
const legacyContentSchema = z.object({
  title: z.string(),
  hook: z.string(),
  voiceover: z.string(),
  scenes: z.array(
    z.object({
      order: z.number(),
      durationSeconds: z.number(),
      voiceover: z.string(),
      visualPrompt: z.string(),
      onScreenText: z.string().optional(),
    }),
  ),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

/**
 * Đọc nội dung đã lưu: v2 -> giữ nguyên; v1 (Phase 02) -> chuyển đổi trong bộ nhớ.
 * Trả về null nếu dữ liệu không nhận dạng được (không ném lỗi để không chặn danh sách).
 */
export function upgradeScriptContent(
  raw: unknown,
  fallback: { targetDurationSeconds?: number; style?: string } = {},
): { document: ScriptDocument; legacy: boolean } | null {
  const v2 = scriptDocumentSchema.safeParse(raw);
  if (v2.success) return { document: v2.data, legacy: false };
  const v1 = legacyContentSchema.safeParse(raw);
  if (!v1.success) return null;
  const c = v1.data;
  const scenes: ScriptScene[] = [...c.scenes]
    .sort((a, b) => a.order - b.order)
    .slice(0, 30)
    .map((s, i, all) => ({
      index: i + 1,
      sceneType: i === 0 ? 'HOOK' : i === all.length - 1 ? 'CTA' : 'FEATURE',
      durationHintSeconds: Math.min(30, Math.max(0.5, s.durationSeconds || 1)),
      description: '',
      visualPrompt: s.visualPrompt.slice(0, 1500),
      spokenText: (s.voiceover.trim() || '…').slice(0, 600),
      overlayText: (s.onScreenText ?? '').slice(0, 120),
      visualSource: 'PRODUCT_IMAGE',
    }));
  if (!scenes.length) {
    scenes.push({
      index: 1,
      sceneType: 'HOOK',
      durationHintSeconds: 3,
      description: '',
      visualPrompt: '',
      spokenText: (c.voiceover.trim() || c.hook.trim() || '…').slice(0, 600),
      overlayText: '',
      visualSource: 'PRODUCT_IMAGE',
    });
  }
  const total = Math.round(scenes.reduce((s, x) => s + x.durationHintSeconds, 0));
  const document: ScriptDocument = {
    schemaVersion: SCRIPT_DOCUMENT_VERSION,
    language: SCRIPT_LANGUAGE,
    title: (c.title.trim() || 'Kịch bản chưa đặt tên').slice(0, 200),
    style: (fallback.style ?? '').slice(0, 60),
    targetDurationSeconds: Math.min(
      180,
      Math.max(5, fallback.targetDurationSeconds ?? total ?? 30),
    ),
    hook: c.hook.slice(0, 300),
    narration: buildNarration(scenes),
    scenes,
    caption: c.caption.slice(0, PUBLISH_CAPTION_MAX),
    hashtags: c.hashtags
      .map((h) => (h.startsWith('#') ? h : `#${h}`).replace(/\s+/g, ''))
      .filter((h) => HASHTAG_RE.test(h))
      .slice(0, PUBLISH_MAX_HASHTAGS),
    cta: c.cta.slice(0, 300),
    complianceFlags: [],
  };
  return { document, legacy: true };
}

// ------------------------------------------------------------------ Kiểm tra chất lượng
export const SCRIPT_ISSUE_SEVERITIES = ['error', 'warning'] as const;
export const scriptIssueSchema = z.object({
  severity: z.enum(SCRIPT_ISSUE_SEVERITIES),
  code: z.string(),
  path: z.string(),
  message: z.string(),
});
export type ScriptIssue = z.infer<typeof scriptIssueSchema>;

// ------------------------------------------------------------------ Template
export const scriptTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  structure: z.array(z.enum(SCENE_TYPES)),
  rules: z.array(z.string()),
  promptTemplate: z.string(),
  /** Điều kiện bắt buộc (vd so sánh cần sản phẩm thứ 2, tuỳ chỉnh cần yêu cầu) */
  requires: z.array(z.enum(['compareProducts', 'customInstructions'])),
});
export type ScriptTemplate = z.infer<typeof scriptTemplateSchema>;

// ------------------------------------------------------------------ Yêu cầu tạo
const durationField = z
  .number()
  .int()
  .refine((v) => (SCRIPT_DURATIONS as readonly number[]).includes(v), {
    message: `Thời lượng phải là ${SCRIPT_DURATIONS.join(', ')} giây`,
  });

export const scriptBriefFields = {
  templateId: z.string().trim().min(1).max(60),
  durationSeconds: durationField,
  audienceId: z.enum(ids(SCRIPT_AUDIENCES)),
  toneId: z.enum(ids(SCRIPT_TONES)),
  hookStyleId: z.enum(ids(HOOK_STYLES)),
  ctaStyleId: z.enum(ids(CTA_STYLES)),
  customInstructions: z.string().trim().max(1500, 'Yêu cầu bổ sung tối đa 1500 ký tự').default(''),
  /** Cho phép đưa GIÁ BÁN vào kịch bản (mặc định không) */
  includePrice: z.boolean().default(false),
  language: z.literal(SCRIPT_LANGUAGE).default(SCRIPT_LANGUAGE),
};

export const scriptGenerateRequestSchema = z
  .object({
    productId: z.uuid(),
    /** Sản phẩm để so sánh (chỉ dùng với template so sánh) */
    compareProductIds: z.array(z.uuid()).max(2).default([]),
    ...scriptBriefFields,
    variantCount: z
      .number()
      .int()
      .refine((v) => (SCRIPT_VARIANT_COUNTS as readonly number[]).includes(v), {
        message: 'Số phiên bản phải là 1, 3, 5 hoặc 10',
      }),
    provider: z.enum(SCRIPT_PROVIDER_IDS).optional(),
    model: z.string().trim().min(1).max(100).optional(),
    /** Độ sáng tạo – CHỈ gửi khi model hỗ trợ (xem providers[].supportsTemperature) */
    temperature: z.number().min(0).max(1).optional(),
  })
  .strict();
export type ScriptGenerateRequest = z.input<typeof scriptGenerateRequestSchema>;
export type ScriptGenerateParsed = z.output<typeof scriptGenerateRequestSchema>;

export const regenerateSceneRequestSchema = z
  .object({
    instructions: z.string().trim().max(800).default(''),
    provider: z.enum(SCRIPT_PROVIDER_IDS).optional(),
    model: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const regenerateCaptionRequestSchema = regenerateSceneRequestSchema;

// ------------------------------------------------------------------ Lưu / sửa
export const scriptManualCreateSchema = z
  .object({
    productId: z.uuid().nullable(),
    document: scriptDocumentSchema,
    origin: z.enum(['manual', 'sample']).default('manual'),
    templateId: z.string().max(60).nullable().default(null),
    config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  })
  .strict();

export const scriptUpdateSchema = z
  .object({
    document: scriptDocumentSchema,
    changeNote: z.string().trim().max(200).optional(),
  })
  .strict();
export type ScriptUpdate = z.input<typeof scriptUpdateSchema>;

export const scriptListQuerySchema = z.object({
  productId: z.uuid().optional(),
  variantGroupId: z.uuid().optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

// ------------------------------------------------------------------ DTO trả về
export const scriptUsageSchema = z.object({
  calls: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  /** Chi phí ƯỚC TÍNH theo đơn giá cấu hình – không phải hoá đơn của nhà cung cấp */
  estimatedCostUsd: z.string(),
});
export type ScriptUsage = z.infer<typeof scriptUsageSchema>;

export const scriptVersionSummarySchema = z.object({
  id: z.uuid(),
  versionNumber: z.number().int(),
  parentId: z.uuid().nullable(),
  origin: z.enum(SCRIPT_ORIGINS),
  changeNote: z.string().nullable(),
  title: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  validationStatus: z.enum(SCRIPT_VALIDATION_STATUSES),
  createdAt: z.iso.datetime(),
});
export type ScriptVersionSummary = z.infer<typeof scriptVersionSummarySchema>;

export const scriptSchema = z.object({
  id: z.uuid(),
  rootId: z.uuid(),
  parentId: z.uuid().nullable(),
  versionNumber: z.number().int(),
  latestVersionNumber: z.number().int(),
  productId: z.uuid().nullable(),
  productName: z.string().nullable(),
  productSku: z.string().nullable(),
  origin: z.enum(SCRIPT_ORIGINS),
  isMock: z.boolean(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  templateId: z.string().nullable(),
  templateVersion: z.string().nullable(),
  style: z.string().nullable(),
  targetDurationSeconds: z.number().int(),
  title: z.string(),
  document: scriptDocumentSchema,
  validationStatus: z.enum(SCRIPT_VALIDATION_STATUSES),
  issues: z.array(scriptIssueSchema),
  /** Thời lượng đọc DỰ KIẾN (không phải thời lượng audio thực tế) */
  estimatedSpeechSeconds: z.number(),
  variantGroupId: z.uuid().nullable(),
  variantIndex: z.number().int().nullable(),
  angleId: z.string().nullable(),
  isPreferred: z.boolean(),
  changeNote: z.string().nullable(),
  config: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  usage: scriptUsageSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Script = z.infer<typeof scriptSchema>;

export const scriptDetailSchema = scriptSchema.extend({
  versions: z.array(scriptVersionSummarySchema),
});
export type ScriptDetail = z.infer<typeof scriptDetailSchema>;

export const scriptGenerationItemSchema = z.object({
  variantIndex: z.number().int(),
  angleId: z.string(),
  angleLabel: z.string(),
  status: z.enum(['success', 'failed']),
  script: scriptSchema.nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

export const scriptGenerationResultSchema = z.object({
  generationId: z.uuid(),
  provider: z.string(),
  model: z.string(),
  isMock: z.boolean(),
  requested: z.number().int(),
  succeeded: z.number().int(),
  failed: z.number().int(),
  items: z.array(scriptGenerationItemSchema),
  usage: scriptUsageSchema,
});
export type ScriptGenerationResult = z.infer<typeof scriptGenerationResultSchema>;

export const scriptProviderModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  supportsTemperature: z.boolean(),
  pricingKnown: z.boolean(),
});

export const scriptProviderStatusSchema = z.object({
  id: z.enum(SCRIPT_PROVIDER_IDS),
  displayName: z.string(),
  isMock: z.boolean(),
  /** ready = có credentials + model; not_configured = thiếu key/model; disabled = bị tắt */
  status: z.enum(['ready', 'not_configured', 'disabled']),
  message: z.string(),
  envVars: z.array(z.string()),
  defaultModel: z.string().nullable(),
  models: z.array(scriptProviderModelSchema),
});
export type ScriptProviderStatus = z.infer<typeof scriptProviderStatusSchema>;

export const scriptProvidersResponseSchema = z.object({
  defaultProvider: z.enum(SCRIPT_PROVIDER_IDS).nullable(),
  providers: z.array(scriptProviderStatusSchema),
});
export type ScriptProvidersResponse = z.infer<typeof scriptProvidersResponseSchema>;

export const providerCheckResultSchema = z.object({
  id: z.enum(SCRIPT_PROVIDER_IDS),
  ok: z.boolean(),
  message: z.string(),
  model: z.string().nullable(),
  checkedAt: z.iso.datetime(),
});
export type ProviderCheckResult = z.infer<typeof providerCheckResultSchema>;

export const scriptEstimateSchema = z.object({
  provider: z.string(),
  model: z.string(),
  calls: z.number().int(),
  estimatedInputTokens: z.number().int(),
  estimatedOutputTokens: z.number().int(),
  /** Ước tính thông thường */
  estimatedCostUsd: z.string(),
  /** Trần chi phí nếu mọi lời gọi dùng hết max token + sửa lỗi */
  maxCostUsd: z.string(),
  pricingKnown: z.boolean(),
  allowed: z.boolean(),
  reason: z.string().nullable(),
  remainingDailyUsd: z.string(),
  remainingMonthlyUsd: z.string().nullable(),
});
export type ScriptEstimate = z.infer<typeof scriptEstimateSchema>;

export const AI_FEATURES = [
  'script_generate',
  'scene_regenerate',
  'caption_generate',
  'provider_check',
] as const;
export const AI_USAGE_STATUSES = [
  'success',
  'failed',
  'invalid_output',
  'refused',
  'rejected_budget',
] as const;

export const aiUsageRecordSchema = z.object({
  id: z.uuid(),
  provider: z.string(),
  model: z.string(),
  feature: z.enum(AI_FEATURES),
  status: z.enum(AI_USAGE_STATUSES),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  estimatedCostUsd: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AiUsageRecord = z.infer<typeof aiUsageRecordSchema>;

export const aiUsageSummarySchema = z.object({
  today: z.object({ calls: z.number().int(), estimatedCostUsd: z.string() }),
  month: z.object({ calls: z.number().int(), estimatedCostUsd: z.string() }),
  budgets: z.object({
    perGenerationUsd: z.number(),
    dailyUsd: z.number(),
    monthlyUsd: z.number(),
    hardStop: z.boolean(),
  }),
  recent: z.array(aiUsageRecordSchema),
});
export type AiUsageSummary = z.infer<typeof aiUsageSummarySchema>;
