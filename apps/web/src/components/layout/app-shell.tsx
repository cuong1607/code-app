'use client';

import { usePersistedFlag } from '@/hooks/use-persisted-flag';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/** Khung chung: sidebar (desktop) / ngăn kéo (mobile) + topbar + vùng nội dung. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistedFlag('acs.sidebar.collapsed', false);
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Bỏ qua tới nội dung chính
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
