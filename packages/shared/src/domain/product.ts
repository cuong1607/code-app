import { z } from 'zod';

export const PRODUCT_STATUSES = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * Dữ liệu nhập khi tạo/sửa sản phẩm.
 * Dùng chung cho form web (Phase 01) và API (Phase 02).
 */
export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Tên sản phẩm phải có ít nhất 2 ký tự')
    .max(200, 'Tên sản phẩm tối đa 200 ký tự'),
  sku: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{2,40}$/, 'SKU gồm 2–40 ký tự: chữ, số, "-" hoặc "_"'),
  category: z.string().trim().min(1, 'Vui lòng chọn danh mục'),
  /** Giá bán tính bằng VND, số nguyên */
  price: z
    .number({ error: 'Giá bán phải là số' })
    .int('Giá bán phải là số nguyên')
    .min(0, 'Giá bán không được âm')
    .max(1_000_000_000, 'Giá bán quá lớn'),
  status: z.enum(PRODUCT_STATUSES),
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').optional(),
  sourceUrl: z.union([z.url('Đường dẫn không hợp lệ'), z.literal('')]).optional(),
});

export type ProductInput = z.infer<typeof productInputSchema>;
