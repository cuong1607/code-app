'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetTitle = SheetPrimitive.Title;
const SheetDescription = SheetPrimitive.Description;

/** Ngăn kéo trượt từ cạnh màn hình (dùng cho menu mobile, panel chi tiết). */
function SheetContent({
  className,
  children,
  side = 'left',
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: 'left' | 'right' }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
      <SheetPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex w-[85vw] max-w-xs flex-col shadow-2xl outline-none',
          side === 'left' ? 'left-0' : 'right-0',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="focus-visible:ring-ring/50 absolute top-3.5 right-3.5 cursor-pointer rounded-md p-1.5 opacity-80 transition-opacity outline-none hover:opacity-100 focus-visible:ring-[3px]">
          <X className="size-4" />
          <span className="sr-only">Đóng</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
