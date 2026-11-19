import { describe, expect, it } from 'vitest';
import {
  formatDisplayDateTime,
  nowUtcIso,
  utcIsoToVnLocalInput,
  vnLocalInputToUtcIso,
} from './time';

describe('chuyển đổi datetime-local (giờ VN) <-> UTC', () => {
  it('giờ VN sang UTC (trừ 7 giờ, qua ngày)', () => {
    expect(vnLocalInputToUtcIso('2026-11-20T05:30')).toBe('2026-11-19T22:30:00.000Z');
  });

  it('UTC sang giá trị input theo giờ VN', () => {
    expect(utcIsoToVnLocalInput('2026-11-19T22:30:00.000Z')).toBe('2026-11-20T05:30');
  });

  it('chuyển đi và chuyển về cho ra cùng giá trị', () => {
    expect(utcIsoToVnLocalInput(vnLocalInputToUtcIso('2026-12-31T23:59'))).toBe('2026-12-31T23:59');
  });

  it('báo lỗi khi định dạng sai', () => {
    expect(() => vnLocalInputToUtcIso('20/11/2026 09:00')).toThrow(RangeError);
  });
});

describe('time', () => {
  it('nowUtcIso trả về ISO UTC kết thúc bằng Z', () => {
    expect(nowUtcIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('chuyển UTC sang giờ Việt Nam (UTC+7)', () => {
    expect(formatDisplayDateTime('2026-01-01T00:00:00.000Z')).toBe('01/01/2026 07:00');
  });

  it('qua ngày khi UTC 17:30 -> 00:30 hôm sau', () => {
    expect(formatDisplayDateTime('2026-03-31T17:30:45Z', { withSeconds: true })).toBe(
      '01/04/2026 00:30:45',
    );
  });

  it('ném lỗi với giá trị thời gian không hợp lệ', () => {
    expect(() => formatDisplayDateTime('không-phải-ngày')).toThrow(RangeError);
  });
});
