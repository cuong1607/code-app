'use client';

import { cn } from '@/lib/utils';

export interface ChipOption<V extends string | number> {
  value: V;
  label: React.ReactNode;
  disabled?: boolean;
  title?: string;
}

/**
 * Nhóm lựa chọn dạng chip (radio group), dùng phím mũi tên để di chuyển.
 * Dùng cho tỷ lệ khung hình, thời lượng, chất lượng…
 */
export function OptionChips<V extends string | number>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: readonly ChipOption<V>[];
  value: V;
  onChange: (value: V) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const enabled = options.filter((o) => !o.disabled);
  const move = (delta: number) => {
    const index = enabled.findIndex((o) => o.value === value);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex flex-wrap gap-1.5', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              'tabular cursor-pointer rounded-md border font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-45',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              checked
                ? 'border-primary bg-primary/15 text-[oklch(0.38_0.09_60)]'
                : 'bg-card hover:border-primary/50 hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
