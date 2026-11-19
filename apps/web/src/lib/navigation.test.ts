import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, findActiveNav } from './navigation';

describe('navigation', () => {
  it('có đủ 8 mục menu theo yêu cầu', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Tổng quan',
      'Sản phẩm',
      'Kịch bản AI',
      'Xưởng ảnh AI',
      'Xưởng video',
      'Thư viện',
      'Lịch đăng TikTok',
      'Cài đặt',
    ]);
  });

  it('khớp route con và không nhầm tiền tố', () => {
    expect(findActiveNav('/studio/videos')?.label).toBe('Xưởng video');
    expect(findActiveNav('/products/abc')?.label).toBe('Sản phẩm');
    expect(findActiveNav('/khong-co')).toBeUndefined();
  });
});
