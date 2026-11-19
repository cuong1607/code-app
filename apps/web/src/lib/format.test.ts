import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatVnd, parseHashtags } from './format';

describe('format', () => {
  it('định dạng VND không có phần thập phân', () => {
    expect(formatVnd(199000).replace(/\s/g, ' ')).toBe('199.000 ₫');
  });

  it('định dạng dung lượng', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5,0 MB');
  });

  it('định dạng thời lượng', () => {
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('chuẩn hoá hashtag và bỏ trùng', () => {
    expect(parseHashtags('#tiktok sale, ##sale  #xuhuong')).toEqual([
      '#tiktok',
      '#sale',
      '#xuhuong',
    ]);
  });
});
