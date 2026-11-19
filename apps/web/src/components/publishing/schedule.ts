import { vnLocalInputToUtcIso } from '@acs/shared';

export const TIKTOK_CAPTION_MAX = 2200;
export const MAX_HASHTAGS = 30;
export const INTERVAL_OPTIONS = [15, 30, 60, 120, 240, 480] as const;

export interface ScheduleInput {
  /** Giá trị datetime-local, hiểu là giờ Việt Nam */
  startLocal: string;
  intervalMinutes: number;
  count: number;
}

/**
 * Tính lịch đăng: bài thứ i đăng lúc start + i * interval.
 * Trả về ISO UTC (quy tắc lưu trữ của hệ thống).
 */
export function computeSchedule({ startLocal, intervalMinutes, count }: ScheduleInput): string[] {
  const start = Date.parse(vnLocalInputToUtcIso(startLocal));
  return Array.from({ length: count }, (_, i) =>
    new Date(start + i * intervalMinutes * 60_000).toISOString(),
  );
}

export interface ScheduleValidation {
  ok: boolean;
  errors: string[];
}

export function validateSchedule(opts: {
  mode: 'immediate' | 'scheduled' | 'draft';
  startLocal: string;
  videoCount: number;
  accountId?: string | null;
  /** Chỉ bắt buộc chọn tài khoản khi đã có tài khoản TikTok kết nối (Phase 08) */
  requireAccount?: boolean;
  caption: string;
  hashtags: string[];
  nowMs: number;
}): ScheduleValidation {
  const errors: string[] = [];
  if (opts.requireAccount && !opts.accountId) errors.push('Chọn tài khoản TikTok');
  if (opts.videoCount === 0) errors.push('Chọn ít nhất 1 video');
  if (opts.caption.length > TIKTOK_CAPTION_MAX)
    errors.push(`Caption tối đa ${TIKTOK_CAPTION_MAX} ký tự`);
  if (opts.hashtags.length > MAX_HASHTAGS) errors.push(`Tối đa ${MAX_HASHTAGS} hashtag`);
  if (opts.mode === 'scheduled') {
    if (!opts.startLocal) errors.push('Chọn thời gian bắt đầu đăng');
    else {
      try {
        if (Date.parse(vnLocalInputToUtcIso(opts.startLocal)) <= opts.nowMs) {
          errors.push('Thời gian bắt đầu phải ở tương lai');
        }
      } catch {
        errors.push('Thời gian bắt đầu không hợp lệ');
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
