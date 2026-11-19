import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/** Logo tạm thời: AI CONTENT STUDIO (không dùng logo bên thứ ba). */
export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className="focus-visible:ring-sidebar-primary/50 flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2"
      aria-label="AI CONTENT STUDIO – về trang tổng quan"
    >
      <span className="from-sidebar-primary grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br to-[oklch(0.62_0.15_45)] text-[oklch(0.18_0.02_50)] shadow-[0_0_0_1px_oklch(1_0_0/0.08)_inset]">
        <Sparkles className="size-[18px]" aria-hidden />
      </span>
      <span className={cn('flex min-w-0 flex-col leading-none', collapsed && 'sr-only')}>
        <span className="text-sidebar-foreground truncate text-[13px] font-bold tracking-wide">
          AI CONTENT
        </span>
        <span className="text-sidebar-primary mt-1 truncate text-[11px] font-semibold tracking-[0.2em]">
          STUDIO
        </span>
      </span>
    </Link>
  );
}
