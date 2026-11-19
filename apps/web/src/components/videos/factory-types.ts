import type { AspectRatio, VideoDuration, VideoMode, VideoQuality } from '@acs/shared';
import type { ImageRef, Product } from '@/types/domain';

/** Cấu hình batch đang soạn ở panel trái. */
export interface FactoryConfig {
  prompt: string;
  promptCategory: string;
  promptTemplateId: string;
  aspectRatio: AspectRatio;
  durationSec: VideoDuration;
  quality: VideoQuality;
  mode: VideoMode;
  voiceId: string;
  templateId: string;
  concurrency: number;
  versionsPerProduct: number;
}

/** Sản phẩm đã chọn vào batch + ảnh tham chiếu đã chọn. */
export interface SelectedProduct {
  product: Product;
  images: ImageRef[];
  primaryImageId?: string;
}

export const PROMPT_VARIABLES = [
  { token: '{product}', description: 'Tên sản phẩm' },
  { token: '{price}', description: 'Giá bán' },
  { token: '{duration}', description: 'Thời lượng (giây)' },
  { token: '{category}', description: 'Danh mục' },
];

export const MAX_CONCURRENCY = 8;
export const MAX_VERSIONS = 5;
