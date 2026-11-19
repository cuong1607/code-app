/**
 * Kiểu dữ liệu domain phía giao diện.
 * Enum trạng thái lấy từ @acs/shared để khớp với backend ở các phase sau.
 */
import type {
  AspectRatio,
  MediaKind,
  ProductStatus,
  PublishMode,
  PublishStatus,
  ScriptScene,
  VideoDuration,
  VideoJobStatus,
  VideoMode,
  VideoQuality,
} from '@acs/shared';

/** Mọi bản ghi demo đều mang cờ này để UI gắn nhãn DEMO. */
export interface DemoFlag {
  isDemo: boolean;
  /** Bản nháp chỉ tồn tại trong trình duyệt, chưa gửi lên máy chủ */
  isLocalDraft?: boolean;
}

export interface ImageRef {
  id: string;
  /** URL thật (presigned) – undefined với dữ liệu demo */
  url?: string;
  /** Màu nền placeholder (0–360) khi không có URL */
  hue: number;
  label?: string;
  isPrimary?: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product extends DemoFlag {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  price: number;
  status: ProductStatus;
  images: ImageRef[];
  description?: string;
  sourceUrl?: string;
  /** ISO UTC */
  createdAt: string;
}

export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  region: 'bac' | 'trung' | 'nam';
}

export interface VideoJob extends DemoFlag {
  id: string;
  name: string;
  batchId: string;
  productId: string;
  productName: string;
  prompt: string;
  images: ImageRef[];
  aspectRatio: AspectRatio;
  durationSec: VideoDuration;
  quality: VideoQuality;
  mode: VideoMode;
  voiceId: string;
  templateId: string;
  status: VideoJobStatus;
  /** 0–100 */
  progress: number;
  resultUrl?: string;
  thumbnail?: ImageRef;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TikTokAccount extends DemoFlag {
  id: string;
  handle: string;
  displayName: string;
  hue: number;
}

export interface PublishPost extends DemoFlag {
  id: string;
  videoJobId: string;
  videoName: string;
  thumbnail: ImageRef;
  accountId: string;
  caption: string;
  hashtags: string[];
  productLink?: string;
  mode: PublishMode;
  /** ISO UTC */
  scheduledAt: string;
  status: PublishStatus;
  errorMessage?: string;
}

export interface MediaAsset extends DemoFlag {
  id: string;
  kind: MediaKind;
  name: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSec?: number;
  preview: ImageRef;
  productId?: string;
  createdAt: string;
}

export interface GeneratedScript extends DemoFlag {
  id: string;
  title: string;
  hook: string;
  voiceover: string;
  scenes: ScriptScene[];
  caption: string;
  hashtags: string[];
  cta: string;
}

export interface ActivityItem extends DemoFlag {
  id: string;
  kind: 'product' | 'script' | 'image' | 'video' | 'publish' | 'system';
  message: string;
  at: string;
}

export interface DashboardSummary extends DemoFlag {
  productCount: number;
  imageCount: number;
  videoCount: number;
  videoCompleted: number;
  videoProcessing: number;
  videoFailed: number;
  batchCount: number;
  /** Chi phí AI ước tính (USD) */
  estimatedAiCostUsd: number;
  videosPerDay: { date: string; count: number }[];
}

/** Kết quả danh sách có phân trang – cùng hình dạng API sẽ trả ở Phase 02. */
export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** true nếu dữ liệu đến từ nguồn demo */
  isDemo: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface ListQuery<SortKey extends string = string> {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SortKey;
  sortDir?: SortDirection;
}
