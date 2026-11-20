import {
  HOME_LIVING_KIND_GROUP,
  IMPORTANT_FACTS_BY_GROUP,
  normalizeSearchText,
  type HomeLivingKind,
  type ItemCount,
  type ProductVisualContext,
  type VisualFact,
  type VisualFactField,
} from '@acs/shared';
import { cleanText } from '../script/product-facts';

/**
 * PRODUCT VISUAL CONTEXT – dữ kiện thị giác của sản phẩm Nhà cửa & Đời sống.
 *
 * CHỈ đọc dữ liệu đã có (tên, danh mục, thuộc tính trong DB). Thiếu thì ghi vào `missing`,
 * KHÔNG suy đoán. Chưa có bước AI phân tích ảnh -> `imageAnalysis: 'none'`.
 * Giá vốn / giá bán / mô tả tự do KHÔNG được dùng cho prompt ảnh.
 */
export interface VisualContextSource {
  id: string;
  name: string;
  category: string;
  attributes: unknown;
}

const MAX_VALUE = 200;

/** Chuẩn hoá để so khớp: bỏ dấu, chữ thường, ký tự không phải chữ/số -> khoảng trắng. */
export function normalizeKey(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ Nhận diện loại sản phẩm
/**
 * Mẫu nhận diện theo thứ tự ưu tiên (cụ thể trước, chung sau). Khi nhiều mẫu khớp,
 * mẫu khớp SỚM NHẤT trong chuỗi thắng (tên tiếng Việt thường bắt đầu bằng danh từ chính:
 * "Ga chun chống thấm" -> ga, không phải thảm). Hoà vị trí -> mẫu đứng trước trong danh sách.
 */
const KIND_PATTERNS: ReadonlyArray<readonly [HomeLivingKind, RegExp]> = [
  ['doormat', /\b(tham (chui|lau) chan|doormat)\b/],
  ['bed_rug', /\btham (trai )?giuong\b/],
  ['bedroom_rug', /\b(tham phong ngu|tham canh giuong|bedroom rug)\b/],
  ['living_room_rug', /\b(tham phong khach|tham sofa|tham ban tra|living room rug)\b/],
  ['rug', /\b(tham|rug|carpet)\b/],
  ['sleeping_mat', /\b(chieu|sleeping mat)\b/],
  ['bedding_set', /\b(bo (chan )?(ga|drap)( goi)?|chan ga goi|chan drap|ga goi|bedding set)\b/],
  ['pillowcase', /\b((vo|ao) goi|pillowcase|pillow case)\b/],
  ['bed_sheet', /\b(ga|drap|ra) (trai giuong|giuong|chun|boc|phu)\b|\b(ga|drap|bed sheet)\b/],
  ['pillow', /\b(ruot goi|goi|pillow)\b/],
  ['blanket', /\b(chan|men|blanket|duvet|quilt)\b/],
  ['other_textile', /\b(khan|rem|vai boc|det may|det gia dung|textile)\b/],
];

function detectKind(text: string): { kind: HomeLivingKind; index: number } | null {
  let best: { kind: HomeLivingKind; index: number } | null = null;
  for (const [kind, re] of KIND_PATTERNS) {
    const m = re.exec(text);
    if (m && (best === null || m.index < best.index)) best = { kind, index: m.index };
  }
  return best;
}

/** Loại cụ thể đọc được từ tên/danh mục (vd "chiếu điều hoà", "chăn lông"). Không suy đoán. */
const SUBTYPE_PATTERNS: Partial<Record<HomeLivingKind, ReadonlyArray<readonly [RegExp, string]>>> =
  {
    sleeping_mat: [
      [/\bchieu dieu hoa\b/, 'Chiếu điều hoà'],
      [/\bchieu coi\b/, 'Chiếu cói'],
      [/\bchieu truc\b/, 'Chiếu trúc'],
      [/\bchieu (may|tre)\b/, 'Chiếu mây/tre'],
      [/\bchieu (cao su|latex)\b/, 'Chiếu cao su'],
      [/\bchieu (lua|tencel)\b/, 'Chiếu lụa/tencel'],
    ],
    blanket: [
      [/\bchan (mua )?he\b/, 'Chăn mùa hè'],
      [/\bchan (mua )?dong\b/, 'Chăn mùa đông'],
      [/\bchan long\b/, 'Chăn lông'],
      [/\bchan mong\b/, 'Chăn mỏng'],
      [/\bchan (bong|phao)\b/, 'Chăn bông/phao'],
      [/\bchan dui\b/, 'Chăn đũi'],
    ],
  };

// ------------------------------------------------------------------ Thuộc tính
/** Tên thuộc tính (đã chuẩn hoá) -> trường thị giác. So khớp chính xác hoặc tiền tố "alias ...". */
const ATTRIBUTE_ALIASES: Record<VisualFactField, readonly string[]> = {
  color: ['mau', 'mau sac', 'mau chu dao', 'tong mau', 'color', 'colour'],
  pattern: ['hoa tiet', 'hoa van', 'hoa', 'hinh in', 'kieu in', 'mau in', 'pattern', 'print'],
  material: ['chat lieu', 'chat vai', 'loai vai', 'vai', 'soi', 'material', 'fabric'],
  size: ['kich thuoc', 'kich co', 'kt', 'size', 'dimensions'],
  shape: ['hinh dang', 'dang', 'shape'],
  setComposition: [
    'bo gom',
    'bo san pham gom',
    'trong bo',
    'thanh phan bo',
    'thanh phan',
    'cau tao',
    'combo',
    'set gom',
    'gom',
  ],
  thickness: ['do day', 'thickness'],
  placement: ['vi tri su dung', 'vi tri', 'khong gian', 'khu vuc su dung', 'su dung cho', 'phong'],
  interiorStyle: ['phong cach noi that', 'phong cach', 'style'],
  subtype: ['loai san pham', 'loai', 'kieu', 'dong san pham', 'type'],
};

function fieldForKey(normalizedKey: string): VisualFactField | null {
  for (const [field, aliases] of Object.entries(ATTRIBUTE_ALIASES) as Array<
    [VisualFactField, readonly string[]]
  >) {
    for (const alias of aliases) {
      if (normalizedKey === alias || normalizedKey.startsWith(`${alias} `)) return field;
    }
  }
  return null;
}

function readAttributes(raw: unknown): Array<{ key: string; value: string }> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    const key = cleanText(k, 60);
    const value = cleanText(String(v), MAX_VALUE);
    if (key && value) out.push({ key, value });
  }
  return out;
}

// ------------------------------------------------------------------ Số lượng thành phần
const ITEM_PATTERNS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [/^(vo|ao) goi om/, 'bolster_case', 'vỏ gối ôm'],
  [/^(vo|ao) goi/, 'pillowcase', 'vỏ gối'],
  [/^(vo|ao) chan/, 'duvet_cover', 'vỏ chăn'],
  [/^(ga|drap|ra)( trai giuong| chun| boc| giuong)?\b/, 'bed_sheet', 'ga trải giường'],
  [/^goi om/, 'bolster', 'gối ôm'],
  [/^(ruot goi|goi)\b/, 'pillow', 'gối'],
  [/^(chan|men)\b/, 'blanket', 'chăn'],
  [/^mon\b/, 'items_total', 'món'],
];

/**
 * Đọc số lượng từ văn bản có SỐ RÕ RÀNG: "1 ga, 2 vỏ gối" / "Bộ 4 món".
 * Không có số -> không suy ra số lượng.
 */
export function parseItemCounts(text: string): ItemCount[] {
  const norm = normalizeKey(text);
  const counts = new Map<string, ItemCount>();
  const re = /\b(\d{1,2})\s+([a-z ]+?)(?=\s+\d|$)/g;
  // Tách theo số: "1 ga 2 vo goi" -> ["1 ga", "2 vo goi"]
  for (const m of norm.matchAll(re)) {
    const n = Number(m[1]);
    const rest = m[2]!.trim();
    if (!n || n > 20) continue;
    for (const [pattern, item, label] of ITEM_PATTERNS) {
      if (pattern.test(rest)) {
        if (!counts.has(item)) counts.set(item, { item, label, count: n });
        break;
      }
    }
  }
  return [...counts.values()];
}

// ------------------------------------------------------------------ Build
export function buildVisualContext(p: VisualContextSource): ProductVisualContext {
  const name = cleanText(p.name, 200);
  const category = cleanText(p.category, 100);
  const attrs = readAttributes(p.attributes);

  const facts: VisualFact[] = [];
  const seen = new Set<VisualFactField>();
  for (const { key, value } of attrs) {
    const field = fieldForKey(normalizeKey(key));
    if (!field || seen.has(field)) continue;
    seen.add(field);
    facts.push({ field, value, source: 'attribute', sourceKey: key });
  }

  // Loại sản phẩm: thuộc tính "Loại" > tên > danh mục
  const subtypeAttr = facts.find((f) => f.field === 'subtype');
  const candidates: Array<{ text: string; source: 'attribute' | 'name' | 'category' }> = [
    ...(subtypeAttr ? [{ text: subtypeAttr.value, source: 'attribute' as const }] : []),
    { text: name, source: 'name' },
    { text: category, source: 'category' },
  ];
  let kind: HomeLivingKind | null = null;
  let kindSource: ProductVisualContext['kindSource'] = null;
  for (const c of candidates) {
    const hit = detectKind(normalizeKey(c.text));
    if (hit) {
      kind = hit.kind;
      kindSource = c.source;
      break;
    }
  }

  // "Thảm" chung: danh mục có thể nói rõ vị trí ("Thảm phòng khách") dù tên không nói
  if (kind === 'rug') {
    const fromCategory = detectKind(normalizeKey(category));
    if (fromCategory && HOME_LIVING_KIND_GROUP[fromCategory.kind] === 'rug') {
      kind = fromCategory.kind;
    }
  }

  // Loại cụ thể từ tên/danh mục khi thuộc tính không có
  if (kind && !seen.has('subtype')) {
    for (const [re, label] of SUBTYPE_PATTERNS[kind] ?? []) {
      const fromName = re.test(normalizeKey(name));
      if (fromName || re.test(normalizeKey(category))) {
        facts.push({
          field: 'subtype',
          value: label,
          source: fromName ? 'name' : 'category',
          sourceKey: null,
        });
        seen.add('subtype');
        break;
      }
    }
  }

  // Số lượng thành phần: chỉ từ thuộc tính "Bộ gồm" hoặc tên có số rõ ("Bộ 4 món")
  const composition = facts.find((f) => f.field === 'setComposition');
  let itemCounts = composition ? parseItemCounts(composition.value) : [];
  if (itemCounts.length === 0) itemCounts = parseItemCounts(name);

  const group = kind ? HOME_LIVING_KIND_GROUP[kind] : null;
  const important = group ? IMPORTANT_FACTS_BY_GROUP[group] : (['color', 'pattern'] as const);
  const missing = important.filter((f) => {
    if (seen.has(f)) return false;
    // Thành phần bộ chỉ quan trọng với sản phẩm dạng bộ
    if (f === 'setComposition') return kind === 'bedding_set' && itemCounts.length === 0;
    return true;
  });

  return {
    productId: p.id,
    productName: name,
    category,
    kind,
    group,
    kindSource,
    facts,
    itemCounts,
    missing: [...missing],
    imageAnalysis: 'none',
  };
}

export function factValue(ctx: ProductVisualContext, field: VisualFactField): string | null {
  return ctx.facts.find((f) => f.field === field)?.value ?? null;
}
