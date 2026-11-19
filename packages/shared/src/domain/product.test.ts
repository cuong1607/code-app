import { describe, expect, it } from 'vitest';
import { productInputSchema, productUpdateSchema } from './product';

const valid = {
  name: 'Áo thun cotton',
  sku: 'at-001',
  category: 'Thời trang',
  sellingPrice: 199000,
  status: 'active' as const,
};

describe('productInputSchema', () => {
  it('chấp nhận dữ liệu hợp lệ, chuẩn hoá SKU in hoa, áp mặc định', () => {
    const r = productInputSchema.parse(valid);
    expect(r.sku).toBe('AT-001');
    expect(r.currency).toBe('VND');
    expect(r.attributes).toEqual({});
    expect(r.brand).toBeUndefined();
  });

  it('báo lỗi tiếng Việt cho từng trường sai', () => {
    const result = productInputSchema.safeParse({
      ...valid,
      name: 'A',
      sku: 'có dấu cách',
      sellingPrice: -1,
      costPrice: 1.234,
      sourceUrl: 'khong-phai-url',
    });
    expect(result.success).toBe(false);
    const byField = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [issue.path[0], issue.message]),
    );
    expect(byField.name).toContain('ít nhất 2 ký tự');
    expect(byField.sku).toContain('SKU');
    expect(byField.sellingPrice).toContain('không được âm');
    expect(byField.costPrice).toContain('2 chữ số thập phân');
    expect(byField.sourceUrl).toContain('không hợp lệ');
  });

  it('cho phép sourceUrl/brand rỗng và giá có 2 số thập phân', () => {
    const r = productInputSchema.parse({
      ...valid,
      sourceUrl: '',
      brand: '  ',
      sellingPrice: 19.99,
    });
    expect(r.sourceUrl).toBeUndefined();
    expect(r.brand).toBeUndefined();
    expect(r.sellingPrice).toBe(19.99);
  });
});

describe('productUpdateSchema', () => {
  it('cập nhật từng phần KHÔNG áp giá trị mặc định (tránh ghi đè currency/attributes)', () => {
    const r = productUpdateSchema.parse({ name: 'Tên mới' });
    expect(r).toEqual({ name: 'Tên mới' });
  });
});
