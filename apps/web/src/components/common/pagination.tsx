'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

/** Trả về danh sách số trang có dấu "…" (VD: 1 … 4 5 6 … 12). */
export function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) result.push('gap');
    result.push(p);
  });
  return result;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      aria-label="Phân trang"
      className={cn(
        'flex flex-col items-center justify-between gap-3 text-sm sm:flex-row',
        className,
      )}
    >
      <div className="text-muted-foreground flex items-center gap-2">
        <span className="tabular">
          {from}–{to} / {total}
        </span>
        {onPageSizeChange ? (
          <NativeSelect
            aria-label="Số dòng mỗi trang"
            className="w-[112px]"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={pageSizeOptions.map((n) => ({ value: String(n), label: `${n}/trang` }))}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
        >
          <ChevronLeft />
        </Button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="text-muted-foreground px-1">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'dark' : 'ghost'}
              size="icon-sm"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Trang ${p}`}
              className="tabular"
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Trang sau"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
