import { describe, expect, it } from 'vitest';
import { normalizeSearchText, parseMoney } from './text';

describe('normalizeSearchText', () => {
  it('bỏ dấu, đ -> d, chữ thường, gộp khoảng trắng', () => {
    expect(normalizeSearchText('  Áo  Thun ĐỎ  ')).toBe('ao thun do');
    expect(normalizeSearchText('Đèn bàn gốm')).toBe('den ban gom');
  });
});

describe('parseMoney', () => {
  it.each([
    ['199000', 199000],
    ['199.000', 199000],
    ['199,000', 199000],
    ['1.250.000 ₫', 1250000],
    ['1,250,000.50', 1250000.5],
    ['1.250.000,50', 1250000.5],
    ['12.5', 12.5],
    ['12,50', 12.5],
    [' 99 000 đ ', 99000],
    [150000, 150000],
  ])('%s -> %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['', 'abc', '12a', null, undefined])('không đọc được: %s', (input) => {
    expect(parseMoney(input)).toBeUndefined();
  });
});
