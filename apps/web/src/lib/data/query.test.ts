import { describe, expect, it } from 'vitest';
import { applyListQuery, normalizeText } from './query';

const items = [
  { name: 'Áo thun', price: 200, cat: 'a' },
  { name: 'Quần jean', price: 400, cat: 'a' },
  { name: 'Đèn bàn', price: 100, cat: 'b' },
];
const options = {
  searchIn: (i: (typeof items)[number]) => [i.name],
  sortValue: (i: (typeof items)[number], key: 'price' | 'name') => i[key],
};

describe('normalizeText', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(normalizeText('Đèn Bàn Gốm')).toBe('den ban gom');
  });
});

describe('applyListQuery', () => {
  it('tìm kiếm không dấu', () => {
    const r = applyListQuery(items, { search: 'ao thun' }, options, true);
    expect(r.items.map((i) => i.name)).toEqual(['Áo thun']);
    expect(r.isDemo).toBe(true);
  });

  it('lọc + sắp xếp tăng dần', () => {
    const r = applyListQuery(
      items,
      { sortBy: 'price', sortDir: 'asc' },
      { ...options, filter: (i) => i.cat === 'a' },
      true,
    );
    expect(r.items.map((i) => i.price)).toEqual([200, 400]);
  });

  it('phân trang và trả tổng số', () => {
    const r = applyListQuery(items, { page: 2, pageSize: 2 }, options, true);
    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(1);
  });
});
