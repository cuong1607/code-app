import { z } from 'zod';
import { paginationQuerySchema } from '../pagination';
import { mediaAssetSchema } from './media';

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const CURRENCIES = ['VND', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRODUCT_SOURCE_TYPES = ['manual', 'import_csv', 'import_xlsx', 'seed'] as const;
export type ProductSourceType = (typeof PRODUCT_SOURCE_TYPES)[number];

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Tiền: số >= 0, tối đa 2 chữ số thập phân. Lưu DB bằng Decimal(14,2) – không dùng Float. */
const money = (label: string) =>
  z
    .number({ error: `${label} phải là số` })
    .finite(`${label} không hợp lệ`)
    .min(0, `${label} không được âm`)
    .max(999_999_999_999, `${label} quá lớn`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
      message: `${label} tối đa 2 chữ số thập phân`,
    });

/** Thông số tự do: { "Màu sắc": "Đỏ", "Kích thước": "M" } */
export const productAttributesSchema = z
  .record(
    z.string().trim().min(1, 'Tên thông số trống').max(60, 'Tên thông số quá dài'),
    z.string().trim().max(500, 'Giá trị thông số quá dài'),
  )
  .refine((obj) => Object.keys(obj).length <= 30, { message: 'Tối đa 30 thông số' });

/** Trường chung KHÔNG có giá trị mặc định (dùng cho cả tạo mới và cập nhật từng phần). */
const productFields = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên sản phẩm phải có ít nhất 2 ký tự')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,40}$/, 'SKU gồm 2–40 ký tự: chữ, số, "-" hoặc "_"')
    .transform((v) => v.toUpperCase()),
  category: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập danh mục')
    .max(100, 'Danh mục tối đa 100 ký tự'),
  brand: optionalText(100, 'Thương hiệu tối đa 100 ký tự'),
  description: optionalText(5000, 'Mô tả tối đa 5000 ký tự'),
  costPrice: money('Giá vốn').nullable().optional(),
  sellingPrice: money('Giá bán'),
  currency: z.enum(CURRENCIES),
  attributes: productAttributesSchema,
  sourceUrl: z
    .union([z.url('Đường dẫn không hợp lệ'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : undefined)),
  status: z.enum(PRODUCT_STATUSES),
});

/** Tạo mới (form web + API POST /products). */
export const productInputSchema = productFields.extend({
  currency: z.enum(CURRENCIES).default('VND'),
  attributes: productAttributesSchema.default({}),
  status: z.enum(PRODUCT_STATUSES).default('draft'),
});
export type ProductInput = z.output<typeof productInputSchema>;
export type ProductFormValues = z.input<typeof productInputSchema>;

/** Cập nhật từng phần (PATCH) – trường bỏ trống không bị ghi đè bằng mặc định. */
export const productUpdateSchema = productFields.partial();
export type ProductUpdate = z.output<typeof productUpdateSchema>;

export const productMediaItemSchema = z.object({
  mediaAssetId: z.uuid(),
  isPrimary: z.boolean(),
  sortOrder: z.number().int(),
  asset: mediaAssetSchema,
});
export type ProductMediaItem = z.infer<typeof productMediaItemSchema>;

/** Sản phẩm trả về từ API. Tiền dạng chuỗi thập phân ("199000.00") để không mất chính xác. */
export const productSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string().nullable(),
  description: z.string().nullable(),
  costPrice: z.string().nullable(),
  sellingPrice: z.string(),
  currency: z.enum(CURRENCIES),
  attributes: z.record(z.string(), z.string()),
  sourceUrl: z.string().nullable(),
  sourceType: z.enum(PRODUCT_SOURCE_TYPES),
  /** URL ảnh ghi nhận từ file import nhưng CHƯA tải về */
  pendingImageUrls: z.array(z.string()),
  status: z.enum(PRODUCT_STATUSES),
  imageCount: z.number().int().nonnegative(),
  primaryImage: mediaAssetSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Product = z.infer<typeof productSchema>;

export const productDetailSchema = productSchema.extend({
  media: z.array(productMediaItemSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const PRODUCT_SORT_KEYS = ['createdAt', 'updatedAt', 'name', 'sku', 'sellingPrice'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const productListQuerySchema = paginationQuerySchema.extend({
  category: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  status: z
    .enum(PRODUCT_STATUSES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  sortBy: z.enum(PRODUCT_SORT_KEYS).default('createdAt'),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Thao tác trên ảnh của sản phẩm */
export const attachMediaSchema = z.object({
  mediaAssetIds: z.array(z.uuid()).min(1, 'Chọn ít nhất 1 ảnh').max(50, 'Tối đa 50 ảnh mỗi lần'),
});
export const reorderMediaSchema = z.object({
  mediaAssetIds: z.array(z.uuid()).min(1).max(200),
});
