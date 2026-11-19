/**
 * Bộ sinh số ngẫu nhiên TẤT ĐỊNH (mulberry32) cho dữ liệu demo.
 * Cùng seed -> cùng kết quả ở server và client => không lệch hydration.
 */
export function createRng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

/** Mốc thời gian cố định cho dữ liệu demo (UTC). */
export const DEMO_NOW = Date.parse('2026-11-19T03:00:00.000Z');

export const minutesAgo = (minutes: number) => new Date(DEMO_NOW - minutes * 60_000).toISOString();
export const minutesAhead = (minutes: number) =>
  new Date(DEMO_NOW + minutes * 60_000).toISOString();
