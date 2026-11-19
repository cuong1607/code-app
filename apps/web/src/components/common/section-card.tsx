'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/** Khối cấu hình có đánh số, thu gọn được – dùng trong panel trái các studio. */
export function SectionCard({
  step,
  title,
  icon: Icon,
  aside,
  children,
  defaultOpen = true,
  className,
}: {
  step?: number;
  title: string;
  icon?: React.ElementType;
  aside?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <section className={cn('bg-card rounded-xl border shadow-xs', className)}>
      <div className="flex items-center gap-2 px-3.5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {step !== undefined ? (
            <span className="bg-sidebar text-sidebar-primary tabular grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold">
              {step}
            </span>
          ) : Icon ? (
            <Icon className="text-muted-foreground size-4" aria-hidden />
          ) : null}
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <ChevronDown
            className={cn(
              'text-muted-foreground ml-auto size-4 shrink-0 transition-transform',
              !open && '-rotate-90',
            )}
            aria-hidden
          />
        </button>
        {aside}
      </div>
      <div
        id={contentId}
        hidden={!open}
        className="flex flex-col gap-3.5 border-t px-3.5 pt-3 pb-4"
      >
        {children}
      </div>
    </section>
  );
}
