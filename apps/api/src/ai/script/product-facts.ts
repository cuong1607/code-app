import type { ScriptProductFacts } from '@acs/shared';

/** Các cột sản phẩm được phép đọc để tạo prompt (whitelist). */
export interface ProductFactsSource {
  name: string;
  sku: string;
  category: string;
  brand: string | null;
  description: string | null;
  sellingPrice: { toString(): string } | string | number;
  currency: string;
  attributes: unknown;
  sourceUrl: string | null;
  /** Số ảnh đã gắn */
  imageCount: number;
  // CỐ Ý không có costPrice / status / pendingImageUrls / id: không bao giờ vào prompt
}

const MAX_DESCRIPTION = 2000;
const MAX_ATTRS = 30;
const MAX_ATTR_KEY = 60;
const MAX_ATTR_VALUE = 300;

/** Bỏ ký tự điều khiển (trừ xuống dòng), gộp khoảng trắng thừa, cắt độ dài. */
export function cleanText(value: string, max: number): string {
  return value
    .replace(
      // eslint-disable-next-line no-control-regex -- cố ý loại ký tự điều khiển khỏi dữ liệu đưa vào prompt
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,
      '',
    )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function flattenAttributes(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_ATTRS) break;
    const key = cleanText(k, MAX_ATTR_KEY);
    if (!key) continue;
    let value: string;
    if (typeof v === 'string') value = v;
    else if (typeof v === 'number' || typeof v === 'boolean') value = String(v);
    else if (Array.isArray(v)) value = v.filter((x) => typeof x !== 'object').join(', ');
    else continue; // object lồng nhau: bỏ qua (không đưa dữ liệu không rõ cấu trúc vào prompt)
    value = cleanText(value, MAX_ATTR_VALUE);
    if (value) out[key] = value;
  }
  return out;
}

function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').slice(0, 100) || null;
  } catch {
    return null;
  }
}

/** Định dạng giá kiểu Việt Nam: 199000 -> "199.000 VND". */
export function formatPriceForScript(price: string, currency: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return `${price} ${currency}`;
  const formatted = new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(n);
  return `${formatted} ${currency}`;
}

/**
 * Chuyển bản ghi sản phẩm -> dữ kiện tối thiểu cần cho kịch bản.
 * Giá bán CHỈ đưa vào khi `includePrice`. Giá vốn, trạng thái, URL đầy đủ KHÔNG bao giờ đưa vào.
 */
export function toProductFacts(
  p: ProductFactsSource,
  opts: { includePrice: boolean },
): ScriptProductFacts {
  return {
    name: cleanText(p.name, 200),
    sku: cleanText(p.sku, 40),
    category: cleanText(p.category, 100),
    brand: p.brand ? cleanText(p.brand, 100) || null : null,
    description: p.description ? cleanText(p.description, MAX_DESCRIPTION) || null : null,
    sellingPrice: opts.includePrice
      ? formatPriceForScript(String(p.sellingPrice), p.currency)
      : null,
    attributes: flattenAttributes(p.attributes),
    sourceDomain: domainOf(p.sourceUrl),
    productImageCount: p.imageCount,
  };
}
