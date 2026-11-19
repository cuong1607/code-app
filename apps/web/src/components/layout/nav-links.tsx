'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip } from '@/components/ui/tooltip';
import { NAV_ITEMS, findActiveNav } from '@/lib/navigation';
import { cn } from '@/lib/utils';

export function NavLinks({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = findActiveNav(pathname);

  return (
    <nav aria-label="Điều hướng chính">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = active?.href === item.href;
          const Icon = item.icon;
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors outline-none',
                'text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-primary/50 focus-visible:ring-2',
                isActive && 'bg-sidebar-accent text-sidebar-foreground',
                collapsed && 'justify-center px-0',
              )}
            >
              {isActive ? (
                <span
                  className="bg-sidebar-primary absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full"
                  aria-hidden
                />
              ) : null}
              <Icon
                className={cn(
                  'size-[18px] shrink-0',
                  isActive ? 'text-sidebar-primary' : 'group-hover:text-sidebar-foreground',
                )}
                aria-hidden
              />
              <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
            </Link>
          );
          return (
            <li key={item.href}>
              {collapsed ? (
                <Tooltip content={item.label} side="right">
                  {link}
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
