import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldBaseClass } from './input';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBaseClass, 'min-h-20 resize-y px-3 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export { Textarea };
