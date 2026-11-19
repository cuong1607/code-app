/**
 * Chuẩn hoá chuỗi để TÌM KIẾM tiếng Việt không phân biệt dấu & hoa/thường.
 * "Áo Thun ĐỎ" -> "ao thun do". Dùng chung ở web (lọc phía client) và API (cột search_text).
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Đọc số tiền theo cách người Việt hay nhập: "199.000", "199,000", "1.250.000 ₫",
 * "199000", "12.5" (thập phân), "12,50" (thập phân). Trả về undefined nếu không đọc được.
 */
export function parseMoney(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
  if (typeof input !== 'string') return undefined;
  let s = input.replace(/\s|₫|đ|vnd|vnđ|usd|\$/gi, '');
  if (!s) return undefined;
  if (!/^-?[\d.,]+$/.test(s)) return undefined;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Có cả 2: dấu xuất hiện sau cùng là dấu thập phân
    const decimal = lastDot > lastComma ? '.' : ',';
    const thousands = decimal === '.' ? ',' : '.';
    s = s.split(thousands).join('').replace(decimal, '.');
  } else {
    const sep = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : '';
    if (sep) {
      const parts = s.split(sep);
      const isThousands = parts.length > 2 || (parts.length === 2 && parts[1]!.length === 3);
      s = isThousands ? parts.join('') : parts.join('.');
    }
  }
  const value = Number(s);
  return Number.isFinite(value) ? value : undefined;
}
