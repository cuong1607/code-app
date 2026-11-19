import { type StatusMeta, TONE_DOT_CLASS } from '@/lib/labels';
import { cn } from '@/lib/utils';

export interface BatchProgressSegment {
  key: string;
  meta: StatusMeta;
  count: number;
}

/** Thanh tiến độ xếp chồng theo trạng thái + chú giải. */
export function BatchProgress({
  segments,
  className,
  title = 'Tiến độ sản xuất',
}: {
  segments: BatchProgressSegment[];
  className?: string;
  title?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const done = segments.find((s) => s.key === 'completed')?.count ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground tabular text-xs">
          {done}/{total} hoàn thành · {percent}%
        </span>
      </div>
      <div
        className="bg-muted flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${done} trên ${total} hoàn thành`}
      >
        {total
          ? segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.key}
                  className={cn('h-full', TONE_DOT_CLASS[s.meta.tone])}
                  style={{ width: `${(s.count / total) * 100}%` }}
                  title={`${s.meta.label}: ${s.count}`}
                />
              ))
          : null}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((s) => (
          <li key={s.key} className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className={cn('size-2 rounded-full', TONE_DOT_CLASS[s.meta.tone])} aria-hidden />
            {s.meta.label}
            <span className="text-foreground tabular font-medium">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
