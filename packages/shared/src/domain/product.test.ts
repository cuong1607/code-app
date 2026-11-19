import { describe, expect, it } from 'vitest';
import { productInputSchema } from './product';

const valid = {
  name: 'Áo thun cotton',
  sku: 'AT-001',
  category: 'thoi-trang',
  price: 199000,
  status: 'active' as const,
};

describe('productInputSchema', () => {
  it('chấp nhận dữ liệu hợp lệ', () => {
    expect(productInputSchema.safeParse(valid).success).toBe(true);
  });

  it('báo lỗi tiếng Việt cho từng trường sai', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      name: 'A',
      sku: 'có dấu cách',
      price: -1,
      sourceUrl: 'khong-phai-url',
    });
    expect(result.success).toBe(false);
    const byField = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
    );
    expect(byField.name).toContain('ít nhất 2 ký tự');
    expect(byField.sku).toContain('SKU');
    expect(byField.price).toContain('không được âm');
    expect(byField.sourceUrl).toContain('không hợp lệ');
  });

  it('cho phép sourceUrl rỗng', () => {
    expect(productInputSchema.safeParse({ ...valid, sourceUrl: '' }).success).toBe(true);
  });
});
