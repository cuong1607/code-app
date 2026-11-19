import type { ScriptDraft as ScriptRow } from '@prisma/client';
import { z } from 'zod';
import {
  type Script,
  type ScriptDocument,
  type ScriptIssue,
  type ScriptVersionSummary,
  SCRIPT_DOCUMENT_VERSION,
  SCRIPT_LANGUAGE,
  estimateSpeechSeconds,
  lintScriptDocument,
  scriptIssueSchema,
  upgradeScriptContent,
} from '@acs/shared';
import { usd } from '../ai/pricing';

export type ScriptRowWithProduct = ScriptRow & {
  product?: { name: string; sku: string } | null;
};

export interface UsageAgg {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

/** Nội dung hỏng/không nhận dạng được -> tài liệu tối thiểu, đánh dấu invalid (không làm sập danh sách). */
function placeholder(row: ScriptRow): ScriptDocument {
  return {
    schemaVersion: SCRIPT_DOCUMENT_VERSION,
    language: SCRIPT_LANGUAGE,
    title: row.title.slice(0, 200) || 'Kịch bản',
    style: row.style ?? '',
    targetDurationSeconds: row.targetDurationSec ?? 30,
    hook: '',
    narration: '…',
    scenes: [
      {
        index: 1,
        sceneType: 'HOOK',
        durationHintSeconds: 3,
        description: 'Nội dung đã lưu không đọc được',
        visualPrompt: '',
        spokenText: '…',
        overlayText: '',
        visualSource: 'PRODUCT_IMAGE',
      },
    ],
    caption: '',
    hashtags: [],
    cta: '',
    complianceFlags: ['Nội dung đã lưu không đọc được – cần soạn lại'],
  };
}

export function readDocument(row: ScriptRow): {
  document: ScriptDocument;
  legacy: boolean;
  corrupt: boolean;
} {
  const up = upgradeScriptContent(row.content, {
    targetDurationSeconds: row.targetDurationSec ?? undefined,
    style: row.style ?? undefined,
  });
  if (!up) return { document: placeholder(row), legacy: false, corrupt: true };
  return { ...up, corrupt: false };
}

const issuesSchema = z.array(scriptIssueSchema);

export function toScriptDto(
  row: ScriptRowWithProduct,
  latestVersionNumber: number,
  usage?: UsageAgg,
): Script {
  const { document, legacy, corrupt } = readDocument(row);
  const stored = issuesSchema.safeParse(row.issues);
  // Bản nháp cũ chưa từng kiểm tra -> kiểm tra ở chế độ "manual" (chỉ cảnh báo) khi đọc
  const issues: ScriptIssue[] =
    legacy || row.validationStatus === 'unchecked'
      ? lintScriptDocument(document, {
          mode: 'manual',
          includePrice: Boolean(row.config && (row.config as Record<string, unknown>).includePrice),
        })
      : stored.success
        ? stored.data
        : [];
  return {
    id: row.id,
    rootId: row.rootId ?? row.id,
    parentId: row.parentId,
    versionNumber: row.versionNumber,
    latestVersionNumber,
    productId: row.productId,
    productName: row.product?.name ?? null,
    productSku: row.product?.sku ?? null,
    origin: row.origin,
    isMock: row.provider === 'mock',
    provider: row.provider,
    model: row.model,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    style: row.style,
    targetDurationSeconds: document.targetDurationSeconds,
    title: document.title,
    document,
    validationStatus: corrupt ? 'invalid' : row.validationStatus,
    issues,
    estimatedSpeechSeconds: estimateSpeechSeconds(document.narration),
    variantGroupId: row.variantGroupId,
    variantIndex: row.variantIndex,
    angleId: row.angleId,
    isPreferred: row.isPreferred,
    changeNote: row.changeNote,
    config: (row.config ?? {}) as Script['config'],
    usage: usage
      ? {
          calls: usage.calls,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd: usd(usage.cost),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVersionSummary(row: ScriptRow): ScriptVersionSummary {
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    parentId: row.parentId,
    origin: row.origin,
    changeNote: row.changeNote,
    title: row.title,
    provider: row.provider,
    model: row.model,
    validationStatus: row.validationStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Các cột phi chuẩn hoá ghi cùng content (để truy vấn/hiển thị nhanh). */
export function documentColumns(doc: ScriptDocument) {
  return {
    title: doc.title,
    hook: doc.hook,
    narration: doc.narration,
    caption: doc.caption,
    hashtags: doc.hashtags,
    cta: doc.cta,
    style: doc.style || null,
    targetDurationSec: doc.targetDurationSeconds,
    content: doc as unknown as object,
  };
}
