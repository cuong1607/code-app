import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldBaseClass =
  'w-full min-w-0 rounded-md border border-input bg-card text-sm shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/20';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBaseClass,
        'h-9 px-3 py-1 file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
