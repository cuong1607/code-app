'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Brand } from './brand';
import { NavLinks } from './nav-links';
import { WorkspaceCard } from './workspace-card';

/** Menu dạng ngăn kéo cho màn hình < lg. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Mở menu điều hướng">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-sidebar text-sidebar-foreground">
        <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
        <SheetDescription className="sr-only">Chọn trang để chuyển tới</SheetDescription>
        <div className="flex h-(--topbar-height) items-center px-4">
          <Brand />
        </div>
        <div className="px-3 pb-3">
          <WorkspaceCard />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
