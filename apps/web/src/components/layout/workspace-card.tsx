'use client';

import { Store } from 'lucide-react';
import { useAsync } from '@/hooks/use-async';
import { workspaceRepository } from '@/lib/data';
import { cn } from '@/lib/utils';

/** Workspace hiện tại (dữ liệu thật từ API /workspace). */
export function WorkspaceCard({ collapsed = false }: { collapsed?: boolean }) {
  const ws = useAsync(() => workspaceRepository.current(), []);
  const name = ws.data?.name ?? (ws.error ? 'Không tải được workspace' : 'Đang tải…');
  return (
    <div
      className={cn(
        'border-sidebar-border bg-sidebar-accent/60 flex items-center gap-2.5 rounded-lg border p-2',
        collapsed && 'justify-center p-1.5',
      )}
      title={`Workspace: ${name}${ws.data ? ' · chế độ phát triển (dev-local)' : ''}`}
    >
      <span className="text-sidebar-primary bg-sidebar grid size-8 shrink-0 place-items-center rounded-md">
        <Store className="size-4" aria-hidden />
      </span>
      <div className={cn('min-w-0 leading-tight', collapsed && 'sr-only')}>
        <p className="text-sidebar-muted text-[10px] font-medium tracking-wider uppercase">
          Workspace
        </p>
        <p className="text-sidebar-foreground truncate text-[13px] font-semibold">{name}</p>
      </div>
      {ws.data?.authMode === 'dev-local' ? (
        <span
          className={cn(
            'border-sidebar-primary/50 text-sidebar-primary ml-auto rounded border border-dashed px-1 text-[9px] font-bold tracking-wider',
            collapsed && 'hidden',
          )}
          title="Chế độ phát triển: chưa có xác thực, chỉ truy cập từ máy cục bộ"
        >
          DEV
        </span>
      ) : null}
    </div>
  );
}
