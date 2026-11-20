import type { ApiEnv, ImageAspect } from '@acs/shared';

/**
 * ĐƠN GIÁ ẢNH THAM KHẢO (USD / ảnh) dùng để ƯỚC TÍNH chi phí – KHÔNG phải hoá đơn.
 *
 * Gemini: bảng giá công khai Google AI (tra cứu 2026-11-20, gói trả phí Standard, theo độ phân giải).
 *   Cộng thêm ESTIMATE_MARGIN cho token đầu vào (ảnh tham chiếu + prompt) và token suy nghĩ – các
 *   khoản này được tính phí nhưng tài liệu không công bố số token cố định cho mọi model.
 * OpenAI: tính theo token, tài liệu không có bảng giá theo ảnh cho model GPT Image hiện hành ->
 *   BẮT BUỘC cấu hình OPENAI_IMAGE_PRICE_PER_IMAGE_USD, thiếu thì từ chối tác vụ.
 */
export const IMAGE_ESTIMATE_MARGIN = 1.15;

export interface GeminiModelSpec {
  label: string;
  prices: Partial<Record<'1K' | '2K', number>>;
  /** Số ảnh đối tượng (object) tham chiếu tối đa theo tài liệu */
  maxReferenceImages: number;
}

export const GEMINI_IMAGE_MODELS: Record<string, GeminiModelSpec> = {
  'gemini-3.1-flash-image': {
    label: 'Gemini 3.1 Flash Image (Nano Banana 2 – ổn định, mặc định)',
    prices: { '1K': 0.067, '2K': 0.101 },
    maxReferenceImages: 10,
  },
  'gemini-nano-banana-2.1': {
    label: 'Gemini Nano Banana 2.1 (mới, rẻ hơn)',
    prices: { '1K': 0.0336, '2K': 0.0504 },
    maxReferenceImages: 10,
  },
  'gemini-3-pro-image': {
    label: 'Gemini 3 Pro Image (Nano Banana Pro – chất lượng cao, đắt)',
    prices: { '1K': 0.134, '2K': 0.134 },
    maxReferenceImages: 6,
  },
};

export const GEMINI_PRICING_SOURCE =
  'Bảng giá công khai Google AI (tra cứu 20/11/2026) + 15% dự phòng token đầu vào – ước tính';

export function geminiPricePerImage(model: string, size: '1K' | '2K'): number | null {
  const base = GEMINI_IMAGE_MODELS[model]?.prices[size];
  return base === undefined ? null : base * IMAGE_ESTIMATE_MARGIN;
}

export function openaiPricePerImage(env: ApiEnv): number | null {
  return env.OPENAI_IMAGE_PRICE_PER_IMAGE_USD ?? null;
}

/**
 * Kích thước gửi OpenAI cho từng tỷ lệ. Tài liệu GPT Image (2.5/2.6) cho phép WIDTHxHEIGHT tuỳ ý với
 * ràng buộc: bội số 16, cạnh ≤ 3840, tỷ lệ trong khoảng 1:3–3:1, tổng điểm ảnh 655.360–8.294.400.
 * Các giá trị dưới đây suy ra từ ràng buộc đó (không phải ví dụ có sẵn trong tài liệu).
 */
export const OPENAI_SIZES: Record<ImageAspect, string> = {
  '1:1': '1024x1024',
  '4:5': '1024x1280',
  '9:16': '1152x2048',
  '16:9': '2048x1152',
};
