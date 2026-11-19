'use client';

import { useCallback, useMemo, useState } from 'react';

/** Quản lý chọn nhiều dòng theo id. */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = useCallback((ids: readonly string[], value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  return useMemo(
    () => ({
      selected,
      count: selected.size,
      has: (id: string) => selected.has(id),
      toggle,
      setMany,
      clear,
    }),
    [selected, toggle, setMany, clear],
  );
}

export type Selection = ReturnType<typeof useSelection>;
