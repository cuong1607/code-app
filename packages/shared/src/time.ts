import { DEFAULT_DISPLAY_TIMEZONE, DEFAULT_LOCALE } from './constants';

/**
 * QUY TẮC THỜI GIAN:
 *  - Lưu trữ & truyền tải: luôn UTC (ISO-8601, kết thúc bằng "Z").
 *  - Hiển thị: chuyển sang Asia/Ho_Chi_Minh (UTC+7) ở tầng giao diện.
 */

/** Thời điểm hiện tại dạng ISO-8601 UTC. */
export function nowUtcIso(): string {
  return new Date().toISOString();
}

function toDate(input: Date | string | number): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Giá trị thời gian không hợp lệ: ${String(input)}`);
  }
  return date;
}

export interface FormatDisplayOptions {
  timeZone?: string;
  locale?: string;
  /** Có hiển thị giây hay không (mặc định: không) */
  withSeconds?: boolean;
}

/** Định dạng thời gian để hiển thị, ví dụ "19/11/2026 21:30". */
export function formatDisplayDateTime(
  input: Date | string | number,
  options: FormatDisplayOptions = {},
): string {
  const {
    timeZone = DEFAULT_DISPLAY_TIMEZONE,
    locale = DEFAULT_LOCALE,
    withSeconds = false,
  } = options;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).formatToParts(toDate(input));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const time = withSeconds
    ? `${get('hour')}:${get('minute')}:${get('second')}`
    : `${get('hour')}:${get('minute')}`;
  return `${get('day')}/${get('month')}/${get('year')} ${time}`;
}

/** Việt Nam dùng UTC+7 cố định, không có giờ mùa hè. */
const VN_OFFSET = '+07:00';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Chuyển giá trị `<input type="datetime-local">` (hiểu là giờ Việt Nam) sang ISO UTC.
 * Ví dụ "2026-11-20T09:00" -> "2026-11-20T02:00:00.000Z".
 */
export function vnLocalInputToUtcIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    throw new RangeError(`Định dạng ngày giờ không hợp lệ: ${value}`);
  }
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  return toDate(`${withSeconds}${VN_OFFSET}`).toISOString();
}

/** Chuyển ISO UTC sang giá trị cho `<input type="datetime-local">` theo giờ Việt Nam. */
export function utcIsoToVnLocalInput(input: Date | string | number): string {
  const shifted = new Date(toDate(input).getTime() + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 16);
}
