'use client';

import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { findActiveNav } from '@/lib/navigation';
import { MobileNav } from './mobile-nav';
import { SystemIndicator } from './system-indicator';
import { UserMenu } from './user-menu';

export function Topbar() {
  const pathname = usePathname();
  const active = findActiveNav(pathname);
  return (
    <header className="bg-background/85 sticky top-0 z-30 flex h-(--topbar-height) shrink-0 items-center gap-2 border-b px-3 backdrop-blur sm:px-5">
      <MobileNav />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="text-muted-foreground hidden sm:inline">AI Content Studio</span>
        <ChevronRight className="text-muted-foreground hidden size-3.5 sm:inline" aria-hidden />
        <span className="truncate font-medium">{active?.label ?? 'Trang'}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <SystemIndicator />
        <UserMenu />
      </div>
    </header>
  );
}
