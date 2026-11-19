import { Store } from 'lucide-react';
import { DEMO_WORKSPACE } from '@/lib/data';
import { cn } from '@/lib/utils';

export function WorkspaceCard({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        'border-sidebar-border bg-sidebar-accent/60 flex items-center gap-2.5 rounded-lg border p-2',
        collapsed && 'justify-center p-1.5',
      )}
      title={`Workspace: ${DEMO_WORKSPACE.name} (DEMO)`}
    >
      <span className="text-sidebar-primary bg-sidebar grid size-8 shrink-0 place-items-center rounded-md">
        <Store className="size-4" aria-hidden />
      </span>
      <div className={cn('min-w-0 leading-tight', collapsed && 'sr-only')}>
        <p className="text-sidebar-muted text-[10px] font-medium tracking-wider uppercase">
          Workspace
        </p>
        <p className="text-sidebar-foreground truncate text-[13px] font-semibold">
          {DEMO_WORKSPACE.name}
        </p>
      </div>
      <span
        className={cn(
          'border-sidebar-primary/50 text-sidebar-primary ml-auto rounded border border-dashed px-1 text-[9px] font-bold tracking-wider',
          collapsed && 'hidden',
        )}
      >
        DEMO
      </span>
    </div>
  );
}
