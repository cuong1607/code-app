'use client';

import { Lock } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Nút cho chức năng CHƯA CÓ backend: luôn disabled, hover/focus hiện lý do.
 * Không bao giờ giả vờ thực hiện thao tác.
 */
export function UnavailableButton({
  reason,
  children,
  className,
  showLock = true,
  ...props
}: Omit<ButtonProps, 'disabled' | 'onClick'> & { reason: string; showLock?: boolean }) {
  return (
    <Tooltip content={reason}>
      {/* Nút disabled không nhận sự kiện chuột -> bọc span có thể focus để hiện tooltip */}
      <span
        tabIndex={0}
        className={cn(
          'inline-flex rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        aria-label={`${typeof children === 'string' ? children : ''} – chưa khả dụng: ${reason}`}
      >
        <Button {...props} disabled aria-disabled className="w-full">
          {showLock ? <Lock aria-hidden /> : null}
          {children}
        </Button>
      </span>
    </Tooltip>
  );
}

/** Chip nhỏ "Chưa khả dụng" kèm tooltip. */
export function UnavailableChip({
  reason,
  label = 'Chưa khả dụng',
}: {
  reason: string;
  label?: string;
}) {
  return (
    <Tooltip content={reason}>
      <span
        tabIndex={0}
        className="bg-muted text-muted-foreground inline-flex shrink-0 cursor-help items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Lock className="size-2.5" aria-hidden />
        {label}
      </span>
    </Tooltip>
  );
}
