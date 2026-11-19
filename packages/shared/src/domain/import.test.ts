import { describe, expect, it } from 'vitest';
import { mapImportRow, suggestImportMapping } from './import';

const HEADERS = [
  'SKU',
  'Tên sản phẩm',
  'Danh mục',
  'Thương hiệu',
  'Giá vốn',
  'Giá bán',
  'Mô tả',
  'Màu sắc',
  'Kích thước',
  'Chất liệu',
  'URL sản phẩm',
  'URL hình ảnh',
];

describe('suggestImportMapping', () => {
  it('nhận diện tiêu đề mẫu tiếng Việt', () => {
    const m = suggestImportMapping(HEADERS);
    expect(m).toMatchObject({
      sku: 0,
      name: 1,
      category: 2,
      brand: 3,
      costPrice: 4,
      sellingPrice: 5,
      description: 6,
      color: 7,
      size: 8,
      material: 9,
      sourceUrl: 10,
      imageUrls: 11,
    });
  });

  it('không dùng 1 cột cho 2 trường, chấp nhận tiêu đề có hậu tố', () => {
    const m = suggestImportMapping(['Mã SP', 'Tên', 'Giá bán (VND)', 'Link', 'Ảnh']);
    expect(m.sku).toBe(0);
    expect(m.name).toBe(1);
    expect(m.sellingPrice).toBe(2);
    expect(m.sourceUrl).toBe(3);
    expect(m.imageUrls).toBe(4);
  });
});

describe('mapImportRow', () => {
  const mapping = suggestImportMapping(HEADERS);

  it('dòng hợp lệ -> ProductInput, ghép thông số và URL ảnh', () => {
    const r = mapImportRow(
      [
        'at-01',
        'Áo thun',
        'Thời trang',
        'Mẫu',
        '90.000',
        '199.000',
        'Mô tả',
        'Đỏ',
        'M',
        'Cotton',
        'https://shop.test/p/1',
        'https://cdn.test/a.jpg, https://cdn.test/b.jpg',
      ],
      mapping,
    );
    expect(r.errors).toEqual([]);
    expect(r.input).toMatchObject({
      sku: 'AT-01',
      sellingPrice: 199000,
      costPrice: 90000,
      attributes: { 'Màu sắc': 'Đỏ', 'Kích thước': 'M', 'Chất liệu': 'Cotton' },
      status: 'draft',
      currency: 'VND',
    });
    expect(r.imageUrls).toHaveLength(2);
  });

  it('báo lỗi rõ ràng từng trường', () => {
    const r = mapImportRow(
      ['x', '', '', '', 'abc', '', '', '', '', '', 'khong-url', 'ftp://a'],
      mapping,
    );
    expect(r.input).toBeNull();
    const text = r.errors.join(' | ');
    expect(text).toContain('Giá vốn "abc"');
    expect(text).toContain('Thiếu giá bán');
    expect(text).toContain('SKU');
    expect(text).toContain('URL hình ảnh không hợp lệ');
  });
});
