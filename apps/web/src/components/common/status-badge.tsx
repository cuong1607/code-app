import { Badge } from '@/components/ui/badge';
import { type StatusMeta, TONE_DOT_CLASS } from '@/lib/labels';
import { cn } from '@/lib/utils';

/**
 * Badge trạng thái thống nhất. Truyền meta từ `lib/labels.ts`
 * (VD: VIDEO_STATUS_META[job.status]) để màu đồng nhất toàn hệ thống.
 */
export function StatusBadge({ meta, className }: { meta: StatusMeta; className?: string }) {
  const animated = meta.tone === 'processing' || meta.tone === 'info';
  return (
    <Badge variant={meta.tone} className={cn('gap-1.5', className)}>
      <span className="relative flex size-1.5" aria-hidden>
        {animated ? (
          <span
            className={cn(
              'absolute inline-flex size-full animate-ping rounded-full opacity-60',
              TONE_DOT_CLASS[meta.tone],
            )}
          />
        ) : null}
        <span
          className={cn('relative inline-flex size-1.5 rounded-full', TONE_DOT_CLASS[meta.tone])}
        />
      </span>
      {meta.label}
    </Badge>
  );
}
