import { z } from 'zod';
import { normalizeSearchText, parseMoney } from '../text';
import { type ProductInput, productInputSchema } from './product';

/** Các trường có thể map từ file Excel/CSV. */
export const IMPORT_FIELDS = [
  { key: 'sku', label: 'SKU', required: true, aliases: ['sku', 'ma sp', 'ma san pham', 'ma hang'] },
  {
    key: 'name',
    label: 'Tên sản phẩm',
    required: true,
    aliases: ['ten san pham', 'ten', 'name', 'product name', 'ten hang'],
  },
  {
    key: 'category',
    label: 'Danh mục',
    required: true,
    aliases: ['danh muc', 'category', 'loai', 'nganh hang'],
  },
  {
    key: 'brand',
    label: 'Thương hiệu',
    required: false,
    aliases: ['thuong hieu', 'brand', 'nhan hieu'],
  },
  {
    key: 'costPrice',
    label: 'Giá vốn',
    required: false,
    aliases: ['gia von', 'cost', 'cost price', 'gia nhap'],
  },
  {
    key: 'sellingPrice',
    label: 'Giá bán',
    required: true,
    aliases: ['gia ban', 'gia', 'price', 'selling price'],
  },
  {
    key: 'description',
    label: 'Mô tả',
    required: false,
    aliases: ['mo ta', 'description', 'mo ta san pham'],
  },
  {
    key: 'color',
    label: 'Màu sắc',
    required: false,
    aliases: ['mau sac', 'mau', 'color', 'colour'],
  },
  { key: 'size', label: 'Kích thước', required: false, aliases: ['kich thuoc', 'size', 'kich co'] },
  { key: 'material', label: 'Chất liệu', required: false, aliases: ['chat lieu', 'material'] },
  {
    key: 'sourceUrl',
    label: 'URL sản phẩm',
    required: false,
    aliases: ['url san pham', 'link san pham', 'product url', 'url', 'link'],
  },
  {
    key: 'imageUrls',
    label: 'URL hình ảnh',
    required: false,
    aliases: [
      'url hinh anh',
      'url anh',
      'link anh',
      'hinh anh',
      'anh',
      'image url',
      'image urls',
      'images',
      'image',
    ],
  },
  { key: 'status', label: 'Trạng thái', required: false, aliases: ['trang thai', 'status'] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key'];
export const IMPORT_FIELD_KEYS = IMPORT_FIELDS.map((f) => f.key) as [
  ImportFieldKey,
  ...ImportFieldKey[],
];

/** Thông số được ghép từ các cột riêng vào `attributes`. */
export const ATTRIBUTE_FIELDS: Partial<Record<ImportFieldKey, string>> = {
  color: 'Màu sắc',
  size: 'Kích thước',
  material: 'Chất liệu',
};

export const IMPORT_MODES = ['skip_duplicates', 'update_duplicates', 'only_new'] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];
export const IMPORT_MODE_LABEL: Record<ImportMode, string> = {
  skip_duplicates: 'Bỏ qua sản phẩm trùng',
  update_duplicates: 'Cập nhật sản phẩm trùng',
  only_new: 'Chỉ nhập sản phẩm mới',
};
export const IMPORT_MODE_DESCRIPTION: Record<ImportMode, string> = {
  skip_duplicates: 'Tạo sản phẩm có SKU mới; dòng có SKU đã tồn tại được bỏ qua.',
  update_duplicates:
    'Tạo sản phẩm mới và CẬP NHẬT sản phẩm có SKU đã tồn tại bằng dữ liệu trong file.',
  only_new: 'Chỉ nhập khi KHÔNG có SKU nào đã tồn tại; nếu có SKU trùng thì dừng, không nhập gì.',
};

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_IMAGE_URLS_PER_ROW = 10;

export const importMappingSchema = z.partialRecord(
  z.enum(IMPORT_FIELD_KEYS),
  z.number().int().min(0).max(199).nullable(),
);
export type ImportMapping = z.infer<typeof importMappingSchema>;

export const importPreviewSchema = z.object({
  fileName: z.string(),
  format: z.enum(['csv', 'xlsx']),
  sheetName: z.string().nullable(),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  totalRows: z.number().int().nonnegative(),
  suggestedMapping: importMappingSchema,
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;

export const importRequestSchema = z.object({
  format: z.enum(['csv', 'xlsx']),
  headers: z.array(z.string().max(200)).max(200),
  rows: z
    .array(z.array(z.string().max(10_000)).max(200))
    .min(1, 'File không có dòng dữ liệu nào')
    .max(IMPORT_MAX_ROWS, `Tối đa ${IMPORT_MAX_ROWS} dòng mỗi lần import`),
  mapping: importMappingSchema,
  mode: z.enum(IMPORT_MODES),
});
export type ImportRequest = z.infer<typeof importRequestSchema>;

export const IMPORT_ROW_ACTIONS = ['create', 'update', 'skip', 'error'] as const;
export type ImportRowAction = (typeof IMPORT_ROW_ACTIONS)[number];

export const importRowResultSchema = z.object({
  rowNumber: z.number().int(),
  sku: z.string().nullable(),
  name: z.string().nullable(),
  action: z.enum(IMPORT_ROW_ACTIONS),
  errors: z.array(z.string()),
  imageUrlCount: z.number().int().nonnegative(),
});
export type ImportRowResult = z.infer<typeof importRowResultSchema>;

export const importResultSchema = z.object({
  mode: z.enum(IMPORT_MODES),
  committed: z.boolean(),
  /** Lý do không ghi gì (VD: chế độ "chỉ nhập mới" gặp SKU trùng) */
  abortedReason: z.string().nullable(),
  summary: z.object({
    total: z.number().int(),
    created: z.number().int(),
    updated: z.number().int(),
    skipped: z.number().int(),
    failed: z.number().int(),
    imageUrls: z.number().int(),
  }),
  rows: z.array(importRowResultSchema),
});
export type ImportResult = z.infer<typeof importResultSchema>;

/** Gợi ý mapping: khớp tiêu đề cột (không dấu) với alias – ưu tiên khớp chính xác. */
export function suggestImportMapping(headers: readonly string[]): ImportMapping {
  const normalized = headers.map((h) =>
    normalizeSearchText(h)
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
  const used = new Set<number>();
  const mapping: ImportMapping = {};
  // Lượt 1: khớp chính xác
  for (const field of IMPORT_FIELDS) {
    const index = normalized.findIndex(
      (h, i) => !used.has(i) && (field.aliases as readonly string[]).includes(h),
    );
    if (index !== -1) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  // Lượt 2: tiêu đề bắt đầu bằng alias dài (VD "gia ban (vnd)")
  for (const field of IMPORT_FIELDS) {
    if (mapping[field.key] !== undefined) continue;
    const aliases = [...field.aliases]
      .filter((a) => a.length >= 4)
      .sort((a, b) => b.length - a.length);
    const index = normalized.findIndex(
      (h, i) => !used.has(i) && aliases.some((a) => h.startsWith(a)),
    );
    if (index !== -1) {
      mapping[field.key] = index;
      used.add(index);
    }
  }
  return mapping;
}

const STATUS_ALIASES: Record<string, ProductInput['status']> = {
  'dang ban': 'active',
  active: 'active',
  'hoat dong': 'active',
  'ban nhap': 'draft',
  nhap: 'draft',
  draft: 'draft',
  'luu tru': 'archived',
  archived: 'archived',
  'ngung ban': 'archived',
};

export interface MappedImportRow {
  input: ProductInput | null;
  sku: string | null;
  name: string | null;
  errors: string[];
  imageUrls: string[];
}

/** Chuyển 1 dòng thô thành dữ liệu sản phẩm đã kiểm tra bằng `productInputSchema`. */
export function mapImportRow(cells: readonly string[], mapping: ImportMapping): MappedImportRow {
  const get = (key: ImportFieldKey): string => {
    const index = mapping[key];
    return index === null || index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const errors: string[] = [];

  const parsePrice = (key: 'costPrice' | 'sellingPrice', label: string): number | undefined => {
    const raw = get(key);
    if (!raw) return undefined;
    const value = parseMoney(raw);
    if (value === undefined) errors.push(`${label} "${raw}" không phải số hợp lệ`);
    return value;
  };
  const sellingPrice = parsePrice('sellingPrice', 'Giá bán');
  const costPrice = parsePrice('costPrice', 'Giá vốn');

  const statusRaw = normalizeSearchText(get('status'));
  const status = statusRaw ? STATUS_ALIASES[statusRaw] : 'draft';
  if (!status)
    errors.push(`Trạng thái "${get('status')}" không hợp lệ (dùng: Đang bán, Bản nháp, Lưu trữ)`);

  const attributes: Record<string, string> = {};
  for (const [key, label] of Object.entries(ATTRIBUTE_FIELDS)) {
    const value = get(key as ImportFieldKey);
    if (value) attributes[label] = value;
  }

  const imageUrls = get('imageUrls')
    .split(/[\s,;|]+/)
    .map((u) => u.trim())
    .filter(Boolean);
  const badUrls = imageUrls.filter((u) => !/^https?:\/\/[^\s]+$/i.test(u));
  if (badUrls.length) errors.push(`URL hình ảnh không hợp lệ: ${badUrls.slice(0, 3).join(', ')}`);
  if (imageUrls.length > IMPORT_MAX_IMAGE_URLS_PER_ROW) {
    errors.push(`Tối đa ${IMPORT_MAX_IMAGE_URLS_PER_ROW} URL hình ảnh mỗi sản phẩm`);
  }

  const parsed = productInputSchema.safeParse({
    sku: get('sku'),
    name: get('name'),
    category: get('category'),
    brand: get('brand'),
    description: get('description'),
    costPrice: costPrice ?? null,
    sellingPrice: sellingPrice ?? (get('sellingPrice') ? Number.NaN : undefined),
    currency: 'VND',
    attributes,
    sourceUrl: get('sourceUrl'),
    status: status ?? 'draft',
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      // Bỏ lỗi trùng với lỗi đọc giá đã báo ở trên
      if (issue.path[0] === 'sellingPrice' && get('sellingPrice') && sellingPrice === undefined)
        continue;
      if (issue.path[0] === 'sellingPrice' && !get('sellingPrice')) {
        errors.push('Thiếu giá bán');
        continue;
      }
      errors.push(issue.message);
    }
  }

  const sku = get('sku') ? get('sku').toUpperCase() : null;
  return {
    input: parsed.success && errors.length === 0 ? parsed.data : null,
    sku,
    name: get('name') || null,
    errors,
    imageUrls: badUrls.length ? [] : imageUrls,
  };
}
