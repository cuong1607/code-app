import { formatDisplayDateTime } from '@acs/shared';

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat('vi-VN');
const usdFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export const formatVnd = (value: number) => vndFormatter.format(value);
export const formatNumber = (value: number) => numberFormatter.format(value);
export const formatUsd = (value: number) => usdFormatter.format(value);

/** Hiển thị thời gian theo Asia/Ho_Chi_Minh (dữ liệu vào là ISO UTC). */
export const formatDateTime = (iso: string) => formatDisplayDateTime(iso);
export const formatDate = (iso: string) => formatDisplayDateTime(iso).slice(0, 10);

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1).replace('.', ',')} ${units[unit]}`;
}

/** 75 -> "1:15" */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "#tiktok #sale" hoặc "tiktok, sale" -> ["#tiktok", "#sale"] */
export function parseHashtags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
  return [...new Set(tags)];
}
