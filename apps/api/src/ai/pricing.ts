import type { ApiEnv } from '@acs/shared';

/**
 * ĐƠN GIÁ THAM KHẢO (USD / 1 triệu token) dùng để ƯỚC TÍNH chi phí.
 * Nguồn: bảng giá công khai của Anthropic (cập nhật 2026-11). Đây KHÔNG phải hoá đơn – chi phí thực tế
 * xem ở trang quản trị của nhà cung cấp. OpenAI: bắt buộc cấu hình qua env (không đoán giá).
 */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

const ANTHROPIC_PRICES: Record<string, ModelPrice> = {
  'claude-fable-5-2': { inputPerMTok: 8, outputPerMTok: 40 },
  'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
  'claude-opus-5': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-opus-4-8': { inputPerMTok: 5, outputPerMTok: 25 },
  'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-sonnet-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-haiku-5-5': { inputPerMTok: 0.1, outputPerMTok: 0.5 },
};

export function priceFor(provider: string, model: string, env: ApiEnv): ModelPrice | null {
  if (provider === 'mock') return { inputPerMTok: 0, outputPerMTok: 0 };
  if (provider === 'anthropic') return ANTHROPIC_PRICES[model] ?? null;
  if (provider === 'openai') {
    const i = env.OPENAI_PRICE_INPUT_PER_MTOK;
    const o = env.OPENAI_PRICE_OUTPUT_PER_MTOK;
    return i !== undefined && o !== undefined ? { inputPerMTok: i, outputPerMTok: o } : null;
  }
  return null;
}

export function costUsd(price: ModelPrice, inputTokens: number, outputTokens: number): number {
  return (inputTokens * price.inputPerMTok + outputTokens * price.outputPerMTok) / 1_000_000;
}

/** Làm tròn 6 chữ số thập phân, trả chuỗi (giống cột Decimal(12,6)). */
export const usd = (n: number) => n.toFixed(6);
