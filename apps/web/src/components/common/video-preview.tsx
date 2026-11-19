import { Film, PlayCircle } from 'lucide-react';
import type { AspectRatio } from '@acs/shared';
import type { ImageRef } from '@/types/domain';
import { cn } from '@/lib/utils';
import { MediaPreview } from './media-preview';

/**
 * Xem trước video. Có `src` thật -> thẻ <video> chuẩn có controls.
 * Không có `src` (DEMO / chưa render) -> khung giữ chỗ kèm giải thích rõ ràng,
 * KHÔNG giả vờ có video.
 */
export function VideoPreview({
  src,
  poster,
  aspect = '9:16',
  emptyMessage = 'Chưa có file video',
  className,
}: {
  src?: string;
  poster?: ImageRef;
  aspect?: AspectRatio;
  emptyMessage?: string;
  className?: string;
}) {
  const aspectClass = {
    '9:16': 'aspect-[9/16]',
    '1:1': 'aspect-square',
    '4:5': 'aspect-[4/5]',
    '16:9': 'aspect-video',
  }[aspect];

  if (src) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        className={cn('w-full rounded-lg bg-black object-contain', aspectClass, className)}
      >
        Trình duyệt của bạn không hỗ trợ phát video.
      </video>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg bg-sidebar',
        aspectClass,
        className,
      )}
    >
      {poster ? (
        <MediaPreview
          image={poster}
          aspect="auto"
          className="absolute inset-0 size-full opacity-35"
          rounded=""
        />
      ) : null}
      <div className="text-sidebar-foreground relative flex size-full flex-col items-center justify-center gap-2 p-4 text-center">
        {poster ? (
          <PlayCircle className="size-10 opacity-60" strokeWidth={1.25} aria-hidden />
        ) : (
          <Film className="size-10 opacity-60" strokeWidth={1.25} aria-hidden />
        )}
        <p className="text-xs font-medium opacity-90">{emptyMessage}</p>
      </div>
    </div>
  );
}
