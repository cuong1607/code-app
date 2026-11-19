/** DỮ LIỆU DEMO – tác vụ Video Factory. KHÔNG có video thật nào được tạo. */
import type { VideoJobStatus } from '@acs/shared';
import type { VideoJob } from '@/types/domain';
import { VIDEO_PROMPT_TEMPLATES, VIDEO_TEMPLATES, VOICES } from './catalog';
import { DEMO_PRODUCTS } from './products';
import { createRng, minutesAgo } from './rng';

const STATUSES: { status: VideoJobStatus; progress: number }[] = [
  { status: 'completed', progress: 100 },
  { status: 'rendering', progress: 78 },
  { status: 'voicing', progress: 42 },
  { status: 'queued', progress: 0 },
  { status: 'completed', progress: 100 },
  { status: 'failed', progress: 55 },
  { status: 'scripting', progress: 15 },
  { status: 'imaging', progress: 60 },
  { status: 'completed', progress: 100 },
  { status: 'queued', progress: 0 },
  { status: 'cancelled', progress: 30 },
  { status: 'completed', progress: 100 },
];

const rng = createRng(42);
const ASPECTS = ['9:16', '9:16', '9:16', '1:1', '4:5'] as const;
const DURATIONS = [15, 20, 30, 30, 45, 60] as const;

export const DEMO_VIDEO_JOBS: VideoJob[] = Array.from({ length: 18 }, (_, index) => {
  const product = DEMO_PRODUCTS[(index * 5) % DEMO_PRODUCTS.length]!;
  const { status, progress } = STATUSES[index % STATUSES.length]!;
  const batch = Math.floor(index / 6) + 1;
  const variant = (index % 3) + 1;
  const created = index * 47 + rng.int(3, 40);
  const durationSec = rng.pick(DURATIONS);
  const prompt = rng
    .pick(VIDEO_PROMPT_TEMPLATES)
    .content.replaceAll('{product}', product.name)
    .replaceAll('{duration}', String(durationSec));
  return {
    id: `demo-job-${index + 1}`,
    name: `Batch ${batch} · ${product.name} · bản ${variant}`,
    batchId: `demo-batch-${batch}`,
    productId: product.id,
    productName: product.name,
    prompt,
    images: product.images.slice(0, 3),
    aspectRatio: rng.pick(ASPECTS),
    durationSec,
    quality: index % 4 === 0 ? '720p' : '1080p',
    mode: 'image_slideshow',
    voiceId: VOICES[index % VOICES.length]!.id,
    templateId: VIDEO_TEMPLATES[index % VIDEO_TEMPLATES.length]!.id,
    status,
    progress,
    thumbnail: status === 'completed' ? product.images[0] : undefined,
    errorMessage:
      status === 'failed' ? 'DEMO: Nhà cung cấp giọng đọc trả lỗi hết hạn mức (429).' : undefined,
    createdAt: minutesAgo(created + 30),
    updatedAt: minutesAgo(created),
    isDemo: true,
  };
});
