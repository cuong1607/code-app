import type {
  ScriptDocument,
  ScriptIssue,
  ScriptScene,
  ScriptTemplate,
} from '../domain/script-engine';
import type { BaseProvider, ProviderCallOptions, ProviderHealth, ProviderUsage } from './common';

/**
 * SCRIPT PROVIDER (Phase 03).
 * Code nghiệp vụ chỉ phụ thuộc interface này; triển khai cụ thể (Claude, OpenAI, Mock) nằm ở
 * apps/api/src/ai/providers – API key không bao giờ rời khỏi server.
 */

/**
 * Dữ kiện sản phẩm ĐÃ LỌC đưa vào prompt.
 * KHÔNG chứa giá vốn, id nội bộ, URL nguồn đầy đủ hay dữ liệu kinh doanh nội bộ.
 * Mọi chuỗi được coi là DỮ LIỆU KHÔNG TIN CẬY (chống prompt injection).
 */
export interface ScriptProductFacts {
  name: string;
  sku: string;
  category: string;
  brand: string | null;
  description: string | null;
  /** Chỉ có khi người dùng cho phép đưa giá vào kịch bản */
  sellingPrice: string | null;
  /** Thuộc tính đã chuẩn hoá: chất liệu, màu sắc, kích thước… */
  attributes: Record<string, string>;
  /** Chỉ tên miền nguồn (không phải URL đầy đủ) */
  sourceDomain: string | null;
  /** Số ảnh sản phẩm thật trong thư viện – AI CHƯA xem nội dung ảnh */
  productImageCount: number;
}

export interface ScriptAngle {
  id: string;
  label: string;
  /** Hướng triển khai đưa vào prompt */
  direction: string;
}

export interface ScriptBrief {
  durationSeconds: number;
  audience: string;
  tone: string;
  hookStyle: string;
  ctaStyle: string;
  customInstructions: string;
  includePrice: boolean;
  language: 'vi-VN';
}

export interface ScriptGenerationInput {
  facts: ScriptProductFacts;
  /** Sản phẩm so sánh (template so sánh) */
  comparison: ScriptProductFacts[];
  template: ScriptTemplate;
  brief: ScriptBrief;
  angle: ScriptAngle;
  /** Biến thể thứ mấy / tổng số – để AI biết cần khác các bản còn lại */
  variant: { index: number; total: number; avoidHooks: string[] };
}

export interface SceneRegenerationInput {
  facts: ScriptProductFacts;
  template: ScriptTemplate;
  brief: ScriptBrief;
  document: ScriptDocument;
  sceneIndex: number;
  instructions: string;
}

export interface CaptionGenerationInput {
  facts: ScriptProductFacts;
  brief: ScriptBrief;
  document: ScriptDocument;
  instructions: string;
}

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  cta: string;
}

/** Thông tin một lần gọi API (mỗi lần thử/sửa là một lần gọi) – để ghi usage. */
export interface ProviderAttemptRecord {
  model: string;
  usage: ProviderUsage;
  latencyMs: number;
  status: 'success' | 'failed' | 'invalid_output' | 'refused';
  errorCode?: string;
  /** Vị trí biến thể (0-based) khi gọi qua generateVariations */
  variantIndex?: number;
}

export interface ScriptCallOptions extends ProviderCallOptions {
  model: string;
  /** Chỉ truyền khi model hỗ trợ */
  temperature?: number;
  /** Gọi sau MỖI lần gọi API (kể cả thất bại) */
  onAttempt?: (record: ProviderAttemptRecord) => void | Promise<void>;
}

export interface ProviderResultMeta {
  /** Model thực sự trả lời (có thể khác model yêu cầu khi provider fallback) */
  model: string;
  usage: ProviderUsage;
  attempts: number;
  latencyMs: number;
}

export interface ScriptGenerationOutput extends ProviderResultMeta {
  document: ScriptDocument;
  issues: ScriptIssue[];
}

export interface SceneRegenerationOutput extends ProviderResultMeta {
  scene: ScriptScene;
  issues: ScriptIssue[];
}

export interface CaptionGenerationOutput extends ProviderResultMeta {
  result: CaptionResult;
}

export type VariationOutcome =
  | { ok: true; angle: ScriptAngle; output: ScriptGenerationOutput }
  | { ok: false; angle: ScriptAngle; error: unknown };

export interface ScriptProvider extends BaseProvider {
  /** true = MockScriptProvider (không gọi AI thật, output có nhãn [MOCK]) */
  readonly isMock: boolean;
  generateScript(
    input: ScriptGenerationInput,
    options: ScriptCallOptions,
  ): Promise<ScriptGenerationOutput>;
  /** Nhiều biến thể; một biến thể lỗi không làm mất các biến thể thành công. */
  generateVariations(
    inputs: ScriptGenerationInput[],
    options: ScriptCallOptions & { concurrency: number },
  ): Promise<VariationOutcome[]>;
  regenerateScene(
    input: SceneRegenerationInput,
    options: ScriptCallOptions,
  ): Promise<SceneRegenerationOutput>;
  generateCaption(
    input: CaptionGenerationInput,
    options: ScriptCallOptions,
  ): Promise<CaptionGenerationOutput>;
  /** Kiểm tra credentials + model (không tốn token nếu provider hỗ trợ). */
  validateConfiguration(model: string): Promise<ProviderHealth>;
}
