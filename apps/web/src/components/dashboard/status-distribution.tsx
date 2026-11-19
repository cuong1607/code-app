import { VIDEO_JOB_STATUSES, type VideoJobStatus } from '@acs/shared';
import { TONE_DOT_CLASS, VIDEO_STATUS_META } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** Sản lượng theo trạng thái: thanh ngang có tỉ lệ. */
export function StatusDistribution({ counts }: { counts: Record<VideoJobStatus, number> }) {
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const max = Math.max(1, ...Object.values(counts));
  return (
    <ul className="flex flex-col gap-2.5">
      {VIDEO_JOB_STATUSES.map((status) => {
        const meta = VIDEO_STATUS_META[status];
        const count = counts[status];
        return (
          <li
            key={status}
            className="grid grid-cols-[minmax(0,10.5rem)_1fr_2rem] items-center gap-3 text-sm"
          >
            <span className="text-muted-foreground flex min-w-0 items-center gap-2">
              <span
                className={cn('size-2 shrink-0 rounded-full', TONE_DOT_CLASS[meta.tone])}
                aria-hidden
              />
              <span className="leading-tight">{meta.label}</span>
            </span>
            <span className="bg-muted h-2 overflow-hidden rounded-full">
              <span
                className={cn('block h-full rounded-full', TONE_DOT_CLASS[meta.tone])}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="tabular text-right font-medium">
              {count}
              <span className="sr-only"> / {total}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
