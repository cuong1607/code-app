'use client';

import { Braces } from 'lucide-react';
import { useId, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export interface PromptVariable {
  token: string;
  description: string;
}

/**
 * Ô soạn prompt có đếm ký tự và chèn biến (VD: {product}, {duration}).
 * Biến được thay bằng dữ liệu thật khi backend chạy job.
 */
export function PromptEditor({
  value,
  onChange,
  label = 'Prompt',
  placeholder,
  maxLength = 2000,
  rows = 6,
  variables = [],
  className,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  variables?: PromptVariable[];
  className?: string;
  error?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const over = value.length > maxLength;

  const insert = (token: string) => {
    const el = ref.current;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span
          className={cn(
            'tabular text-xs',
            over ? 'text-danger font-medium' : 'text-muted-foreground',
          )}
        >
          {value.length}/{maxLength}
        </span>
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={over || Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className="text-[13px]"
      />
      {variables.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Braces className="text-muted-foreground size-3.5" aria-hidden />
          {variables.map((v) => (
            <button
              key={v.token}
              type="button"
              title={v.description}
              onClick={() => insert(v.token)}
              className="bg-muted hover:bg-primary/15 cursor-pointer rounded px-1.5 py-0.5 font-mono text-[11px] transition-colors"
            >
              {v.token}
            </button>
          ))}
        </div>
      ) : null}
      {error || over ? (
        <p id={`${id}-error`} className="text-danger text-xs">
          {error ?? `Prompt vượt quá ${maxLength} ký tự`}
        </p>
      ) : null}
    </div>
  );
}
