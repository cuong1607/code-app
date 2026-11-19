import {
  type ScriptDocument,
  type ScriptIssue,
  type ScriptScene,
  SCRIPT_DOCUMENT_VERSION,
  SCRIPT_LANGUAGE,
  buildNarration,
  lintScriptDocument,
  scriptDocumentSchema,
} from '@acs/shared';
import type { z } from 'zod';
import { aiCaptionOutputSchema, aiSceneOutputSchema, aiScriptOutputSchema } from './output-schema';

export interface LintContext {
  includePrice: boolean;
  sellingPriceDigits: string | null;
  speechSpeed: number;
}

export type ValidationResult<T> =
  | { ok: true; value: T; issues: ScriptIssue[] }
  | { ok: false; errors: { path: string; message: string }[] };

/** Chuẩn hoá hashtag: thêm '#', bỏ khoảng trắng, bỏ trùng. */
export function normalizeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = `#${raw.replace(/^#+/, '').replace(/\s+/g, '')}`;
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

function zodErrors(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/** Parse văn bản trả về -> object. Không dùng JSON.parse "trần" mà luôn có validate phía sau. */
export function parseJsonText(
  text: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {
    return { ok: false, message: 'Phản hồi không phải JSON hợp lệ' };
  }
}

const onlyErrors = (issues: ScriptIssue[]) =>
  issues.filter((i) => i.severity === 'error').map((i) => ({ path: i.path, message: i.message }));

/**
 * Kiểm tra output kịch bản của AI:
 *  1) cấu trúc (Zod strict) 2) dựng ScriptDocument (server tự ghép narration)
 *  3) lint chất lượng/tuân thủ – lỗi mức "error" => trả về để provider yêu cầu AI sửa.
 */
export function validateScriptOutput(
  raw: unknown,
  meta: { style: string; targetDurationSeconds: number },
  ctx: LintContext,
): ValidationResult<ScriptDocument> {
  const parsed = aiScriptOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const o = parsed.data;
  const scenes: ScriptScene[] = o.scenes.map((s) => ({ ...s }));
  const draft = {
    schemaVersion: SCRIPT_DOCUMENT_VERSION,
    language: SCRIPT_LANGUAGE,
    title: o.title,
    style: meta.style.slice(0, 60),
    targetDurationSeconds: meta.targetDurationSeconds,
    hook: o.hook,
    narration: buildNarration(scenes),
    scenes,
    caption: o.caption,
    hashtags: normalizeHashtags(o.hashtags),
    cta: o.cta,
    complianceFlags: o.complianceFlags,
  };
  const doc = scriptDocumentSchema.safeParse(draft);
  if (!doc.success) return { ok: false, errors: zodErrors(doc.error) };
  const issues = lintScriptDocument(doc.data, { mode: 'ai', ...ctx });
  const errors = onlyErrors(issues);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: withComplianceFlags(doc.data, issues), issues };
}

/** Gộp cảnh báo của server vào complianceFlags (để người dùng thấy ngay trong kịch bản). */
export function withComplianceFlags(doc: ScriptDocument, issues: ScriptIssue[]): ScriptDocument {
  const extra = issues
    .filter((i) => i.severity === 'warning' && /CLAIM|FIRST_PERSON|TESTIMONIAL/.test(i.code))
    .map((i) => `[Kiểm tra tự động] ${i.message} (${i.path})`);
  return { ...doc, complianceFlags: [...new Set([...doc.complianceFlags, ...extra])].slice(0, 30) };
}

/** Kiểm tra cảnh tạo lại: thay vào kịch bản rồi lint toàn bộ (chỉ lỗi của cảnh đó mới chặn). */
export function validateSceneOutput(
  raw: unknown,
  document: ScriptDocument,
  sceneIndex: number,
  ctx: LintContext,
): ValidationResult<ScriptScene> {
  const parsed = aiSceneOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const scene: ScriptScene = { ...parsed.data.scene, index: sceneIndex };
  const scenes = document.scenes.map((s) => (s.index === sceneIndex ? scene : s));
  const doc = { ...document, scenes, narration: buildNarration(scenes) };
  const issues = lintScriptDocument(doc, { mode: 'ai', ...ctx });
  const prefix = `scenes.${sceneIndex - 1}.`;
  const errors = onlyErrors(issues.filter((i) => i.path.startsWith(prefix)));
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: scene, issues };
}

export function validateCaptionOutput(
  raw: unknown,
  document: ScriptDocument,
  ctx: LintContext,
): ValidationResult<{ caption: string; hashtags: string[]; cta: string }> {
  const parsed = aiCaptionOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const value = { ...parsed.data, hashtags: normalizeHashtags(parsed.data.hashtags) };
  const docCheck = scriptDocumentSchema.safeParse({ ...document, ...value });
  if (!docCheck.success) return { ok: false, errors: zodErrors(docCheck.error) };
  const issues = lintScriptDocument(docCheck.data, { mode: 'ai', ...ctx });
  const errors = onlyErrors(issues.filter((i) => ['caption', 'cta', 'hashtags'].includes(i.path)));
  if (errors.length) return { ok: false, errors };
  return { ok: true, value, issues };
}
