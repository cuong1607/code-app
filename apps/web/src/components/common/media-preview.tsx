import { ImageIcon, Music, Video } from 'lucide-react';
import type { ImageRef } from '@/types/domain';
import { cn } from '@/lib/utils';

const ASPECT_CLASS = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
  auto: '',
} as const;

export type PreviewAspect = keyof typeof ASPECT_CLASS;

/**
 * Hiển thị ảnh. Nếu không có URL thật (dữ liệu DEMO) thì vẽ khối màu
 * placeholder thay vì dùng ảnh giả trông như thật.
 */
export function MediaPreview({
  image,
  aspect = '1:1',
  kind = 'image',
  className,
  alt,
  showLabel = false,
  rounded = 'rounded-md',
}: {
  image?: ImageRef;
  aspect?: PreviewAspect;
  kind?: 'image' | 'video' | 'audio';
  className?: string;
  alt?: string;
  showLabel?: boolean;
  rounded?: string;
}) {
  const hue = image?.hue ?? 40;
  const Icon = kind === 'video' ? Video : kind === 'audio' ? Music : ImageIcon;
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden', ASPECT_CLASS[aspect], rounded, className)}
      style={
        image?.url
          ? undefined
          : {
              background: `linear-gradient(135deg, oklch(0.9 0.05 ${hue}), oklch(0.75 0.09 ${(hue + 30) % 360}))`,
            }
      }
    >
      {image?.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- hỗ trợ cả blob: URL của ảnh vừa chọn
        <img src={image.url} alt={alt ?? image.label ?? ''} className="size-full object-cover" />
      ) : (
        <div
          className="flex size-full flex-col items-center justify-center gap-1 text-[oklch(0.35_0.05_60)]/70"
          role="img"
          aria-label={alt ?? `Ảnh mẫu${image?.label ? ` – ${image.label}` : ''}`}
        >
          <Icon
            className="size-[38%] max-h-8 max-w-8 min-h-3 min-w-3"
            strokeWidth={1.5}
            aria-hidden
          />
          {showLabel && image?.label ? (
            <span className="max-w-full truncate px-1 text-[10px] font-medium">{image.label}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
