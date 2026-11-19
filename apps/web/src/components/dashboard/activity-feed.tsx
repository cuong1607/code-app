import { CalendarClock, Clapperboard, FileText, ImageIcon, Package, Server } from 'lucide-react';
import type { ActivityItem } from '@/types/domain';
import { formatDateTime } from '@/lib/format';

const ICON: Record<ActivityItem['kind'], React.ElementType> = {
  product: Package,
  script: FileText,
  image: ImageIcon,
  video: Clapperboard,
  publish: CalendarClock,
  system: Server,
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border">
      {items.map((item) => {
        const Icon = ICON[item.kind];
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className="bg-card text-muted-foreground relative grid size-8 shrink-0 place-items-center rounded-full border">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm leading-snug">{item.message}</p>
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
