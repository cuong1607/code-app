'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Cờ boolean lưu ở localStorage (tiện ích per-user, VD: thu gọn sidebar).
 * Mọi truy cập storage bọc try/catch vì có thể bị chặn (chế độ riêng tư...).
 */
const listeners = new Set<() => void>();

function read(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

export function usePersistedFlag(
  key: string,
  fallback = false,
): [boolean, (value: boolean) => void] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    window.addEventListener('storage', cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener('storage', cb);
    };
  }, []);

  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? '1' : '0');
      } catch {
        // bỏ qua: không lưu được thì chỉ mất ghi nhớ, UI vẫn hoạt động
      }
      listeners.forEach((cb) => cb());
    },
    [key],
  );

  return [value, set];
}
