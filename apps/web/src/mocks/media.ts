/** DỮ LIỆU DEMO – thư viện tài nguyên. Không có file thật trong storage. */
import type { MediaKind } from '@acs/shared';
import type { MediaAsset } from '@/types/domain';
import { DEMO_PRODUCTS } from './products';
import { createRng, minutesAgo } from './rng';

const rng = createRng(7);
const KINDS: MediaKind[] = ['product_image', 'ai_image', 'video', 'audio', 'thumbnail'];

const SPEC: Record<MediaKind, { ext: string; mime: string }> = {
  product_image: { ext: 'jpg', mime: 'image/jpeg' },
  ai_image: { ext: 'png', mime: 'image/png' },
  video: { ext: 'mp4', mime: 'video/mp4' },
  audio: { ext: 'mp3', mime: 'audio/mpeg' },
  thumbnail: { ext: 'jpg', mime: 'image/jpeg' },
};

export const DEMO_MEDIA: MediaAsset[] = Array.from({ length: 30 }, (_, index) => {
  const kind = KINDS[index % KINDS.length]!;
  const product = DEMO_PRODUCTS[index % DEMO_PRODUCTS.length]!;
  const { ext, mime } = SPEC[kind];
  const isVisual = kind !== 'audio';
  const isVertical = kind === 'video' || kind === 'thumbnail';
  return {
    id: `demo-media-${index + 1}`,
    kind,
    name: `${product.sku.toLowerCase()}-${kind.replace('_', '-')}-${index + 1}.${ext}`,
    mimeType: mime,
    sizeBytes:
      kind === 'video'
        ? rng.int(8, 40) * 1024 * 1024
        : kind === 'audio'
          ? rng.int(300, 900) * 1024
          : rng.int(180, 2400) * 1024,
    width: isVisual ? (isVertical ? 1080 : 1200) : undefined,
    height: isVisual ? (isVertical ? 1920 : 1200) : undefined,
    durationSec: kind === 'video' || kind === 'audio' ? rng.int(15, 60) : undefined,
    preview: { id: `demo-media-preview-${index + 1}`, hue: (index * 37) % 360 },
    productId: product.id,
    createdAt: minutesAgo(index * 211 + rng.int(1, 90)),
    isDemo: true,
  };
});
