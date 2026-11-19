'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import { NavLinks } from './nav-links';
import { WorkspaceCard } from './workspace-card';

/** Sidebar desktop (>= lg), thu gọn được. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
        collapsed ? 'w-(--sidebar-width-collapsed)' : 'w-(--sidebar-width)',
      )}
    >
      <div
        className={cn(
          'flex h-(--topbar-height) items-center px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <Brand collapsed={collapsed} />
      </div>
      <div className={cn('px-3 pb-3', collapsed && 'px-2')}>
        <WorkspaceCard collapsed={collapsed} />
      </div>
      <div className={cn('scrollbar-thin flex-1 overflow-y-auto px-3 py-1', collapsed && 'px-2')}>
        <p
          className={cn(
            'text-sidebar-muted/70 mb-1.5 px-3 text-[10px] font-semibold tracking-widest uppercase',
            collapsed && 'sr-only',
          )}
        >
          Không gian làm việc
        </p>
        <NavLinks collapsed={collapsed} />
      </div>
      <div className={cn('border-sidebar-border border-t p-3', collapsed && 'px-2')}>
        <Tooltip
          content={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          side="right"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
            aria-expanded={!collapsed}
            className={cn(
              'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-primary/50 flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] transition-colors outline-none focus-visible:ring-2',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" />
            ) : (
              <PanelLeftClose className="size-[18px]" />
            )}
            <span className={cn(collapsed && 'sr-only')}>Thu gọn</span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
