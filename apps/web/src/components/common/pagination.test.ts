import { describe, expect, it } from 'vitest';
import { pageWindow } from './pagination';

describe('pageWindow', () => {
  it('hiện đủ khi ít trang', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('chèn dấu … khi nhiều trang', () => {
    expect(pageWindow(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
  });

  it('trang đầu', () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, 'gap', 12]);
  });
});
