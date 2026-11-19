import * as React from 'react';
import { cn } from '@/lib/utils';

/** Khối xám nhấp nháy dùng cho loading skeleton. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted animate-shimmer rounded-md', className)}
      {...props}
    />
  );
}

export function Separator({
  className,
  orientation = 'horizontal',
}: {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border shrink-0',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
    />
  );
}

/** Thanh tiến độ 0–100. */
export function Progress({
  value,
  className,
  tone = 'primary',
  label,
}: {
  value: number;
  className?: string;
  tone?: 'primary' | 'success' | 'danger' | 'processing' | 'neutral';
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = {
    primary: 'bg-primary',
    success: 'bg-success',
    danger: 'bg-danger',
    processing: 'bg-processing',
    neutral: 'bg-neutral/60',
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={label}
      className={cn('bg-muted h-1.5 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width]', color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/** Kbd hiển thị phím tắt. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}
