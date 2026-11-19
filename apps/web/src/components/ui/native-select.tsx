import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldBaseClass } from './input';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  disabled?: boolean;
}

type NativeSelectProps = Omit<React.ComponentProps<'select'>, 'children'> & {
  options: readonly SelectOption[];
  placeholder?: string;
};

/**
 * Select dùng thẻ <select> gốc: truy cập bàn phím/màn hình đọc tốt,
 * và hiển thị picker hệ thống trên mobile.
 */
function NativeSelect({ className, options, placeholder, ...props }: NativeSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        data-slot="select"
        className={cn(fieldBaseClass, 'h-9 cursor-pointer appearance-none py-1 pr-8 pl-3')}
        {...props}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}

export { NativeSelect };
