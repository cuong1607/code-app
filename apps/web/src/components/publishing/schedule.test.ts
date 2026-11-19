import { describe, expect, it } from 'vitest';
import { computeSchedule, validateSchedule } from './schedule';

describe('computeSchedule', () => {
  it('tính lịch theo giờ VN và trả UTC, cách đều theo khoảng', () => {
    expect(
      computeSchedule({ startLocal: '2026-11-20T08:00', intervalMinutes: 90, count: 3 }),
    ).toEqual(['2026-11-20T01:00:00.000Z', '2026-11-20T02:30:00.000Z', '2026-11-20T04:00:00.000Z']);
  });
});

describe('validateSchedule', () => {
  const base = {
    mode: 'scheduled' as const,
    startLocal: '2026-11-20T08:00',
    videoCount: 2,
    accountId: 'acc-1',
    caption: 'ok',
    hashtags: ['#a'],
    nowMs: Date.parse('2026-11-19T00:00:00Z'),
  };

  it('hợp lệ', () => {
    expect(validateSchedule(base).ok).toBe(true);
  });

  it('thời gian trong quá khứ bị từ chối', () => {
    const r = validateSchedule({ ...base, nowMs: Date.parse('2026-11-21T00:00:00Z') });
    expect(r.errors).toContain('Thời gian bắt đầu phải ở tương lai');
  });

  it('thiếu video, tài khoản và caption quá dài', () => {
    const r = validateSchedule({
      ...base,
      videoCount: 0,
      accountId: '',
      caption: 'x'.repeat(2201),
    });
    expect(r.errors).toHaveLength(3);
  });

  it('chế độ đăng ngay không cần thời gian', () => {
    expect(validateSchedule({ ...base, mode: 'immediate', startLocal: '' }).ok).toBe(true);
  });
});
