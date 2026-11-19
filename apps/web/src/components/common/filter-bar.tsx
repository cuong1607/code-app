'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Thanh chứa ô tìm kiếm + các bộ lọc; tự xuống dòng trên màn hình nhỏ. */
export function FilterBar({
  children,
  onReset,
  canReset,
  end,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  canReset?: boolean;
  /** Nội dung căn phải (VD: chuyển grid/list) */
  end?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}
      role="search"
    >
      {children}
      {onReset && canReset ? (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw /> Xoá bộ lọc
        </Button>
      ) : null}
      {end ? <div className="flex items-center gap-2 sm:ml-auto">{end}</div> : null}
    </div>
  );
}
