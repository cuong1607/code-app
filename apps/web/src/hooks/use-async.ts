'use client';

import { useCallback, useEffect, useState } from 'react';
import { describeError } from '@/lib/api/client';

export interface AsyncState<T> {
  data: T | undefined;
  error: string | undefined;
  loading: boolean;
  reload: () => void;
}

/**
 * Chạy một hàm async (repository/API) và quản lý loading / error / data.
 *
 * `deps` phải là giá trị nguyên thuỷ (string/number/boolean) – chúng tạo thành
 * "khoá request". `loading` = kết quả hiện có chưa khớp khoá mới nhất, nên không cần
 * setState đồng bộ trong effect; kết quả của request cũ bị bỏ qua.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: readonly (string | number | boolean | undefined)[],
): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([...deps, nonce]);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();

  useEffect(() => {
    let active = true;
    fn()
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((err: unknown) => {
        if (active) setResult({ key, error: describeError(err) });
      });
    return () => {
      active = false;
    };
    // `fn` thay đổi mỗi lần render; chỉ chạy lại khi khoá request đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = result?.key !== key;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: result?.data, error: loading ? undefined : result?.error, loading, reload };
}
