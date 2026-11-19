import { CalendarClock, Clapperboard, FileText, ImageIcon, Package } from 'lucide-react';
import type { DashboardSummary } from '@acs/shared';
import { formatDateTime } from '@/lib/format';

type Activity = DashboardSummary['recentActivity'][number];

const ICON: Record<Activity['kind'], React.ElementType> = {
  product: Package,
  media: ImageIcon,
  video_draft: Clapperboard,
  publishing_draft: CalendarClock,
  script_draft: FileText,
};

export function ActivityFeed({ items }: { items: Activity[] }) {
  if (!items.length) return <p className="text-muted-foreground text-sm">Chưa có hoạt động nào.</p>;
  return (
    <ol className="before:bg-border relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px">
      {items.map((item) => {
        const Icon = ICON[item.kind];
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className="bg-card text-muted-foreground relative grid size-8 shrink-0 place-items-center rounded-full border">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug break-words">{item.message}</p>
              <time dateTime={item.at} className="text-muted-foreground text-xs">
                {formatDateTime(item.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
