/**
 * TẦNG DỮ LIỆU (repository) – UI chỉ import từ đây.
 *
 * Phase 01: mọi repository đọc DỮ LIỆU DEMO trong `src/mocks` (isDemo = true),
 * KHÔNG ghi gì vào database. Phase 02+: thay phần thân bằng `apiRequest(...)`
 * tới NestJS mà không phải sửa component.
 */
import type { MediaKind, ProductStatus, PublishStatus } from '@acs/shared';
import {
  DEMO_ACTIVITIES,
  DEMO_DASHBOARD,
  DEMO_MEDIA,
  DEMO_PRODUCTS,
  DEMO_PUBLISH_POSTS,
  DEMO_VIDEO_JOBS,
  buildDemoScript,
  categoryName,
} from '@/mocks';
import type {
  ActivityItem,
  DashboardSummary,
  GeneratedScript,
  ListQuery,
  ListResult,
  MediaAsset,
  Product,
  PublishPost,
  VideoJob,
} from '@/types/domain';
import { applyListQuery } from './query';

/** Nguồn dữ liệu hiện tại. Đổi sang 'api' khi backend sẵn sàng. */
export const DATA_SOURCE = 'demo' as const;
const IS_DEMO = DATA_SOURCE === 'demo';

export * from './catalog';

// ---------------------------------------------------------------- Products
export type ProductSortKey = 'name' | 'price' | 'createdAt' | 'sku' | 'imageCount';
export interface ProductListQuery extends ListQuery<ProductSortKey> {
  categoryId?: string;
  status?: ProductStatus | '';
}

export const productRepository = {
  async list(query: ProductListQuery): Promise<ListResult<Product>> {
    return applyListQuery(
      DEMO_PRODUCTS,
      query,
      {
        searchIn: (p) => [p.name, p.sku, categoryName(p.categoryId)],
        filter: (p) =>
          (!query.categoryId || p.categoryId === query.categoryId) &&
          (!query.status || p.status === query.status),
        sortValue: (p, key) =>
          key === 'imageCount' ? p.images.length : key === 'price' ? p.price : p[key],
      },
      IS_DEMO,
    );
  },
  /** Danh sách rút gọn cho các ô chọn sản phẩm. */
  async options(): Promise<Product[]> {
    return DEMO_PRODUCTS.filter((p) => p.status !== 'archived');
  },
};

// ---------------------------------------------------------------- Video jobs
export const videoJobRepository = {
  async list(): Promise<{ items: VideoJob[]; isDemo: boolean }> {
    return { items: DEMO_VIDEO_JOBS, isDemo: IS_DEMO };
  },
};

export type VideoJobFilter = 'all' | 'queued' | 'running' | 'completed' | 'failed';

// ---------------------------------------------------------------- Publishing
export const publishRepository = {
  async list(): Promise<{ items: PublishPost[]; isDemo: boolean }> {
    return { items: DEMO_PUBLISH_POSTS, isDemo: IS_DEMO };
  },
};
export type PublishTab = 'all' | PublishStatus;

// ---------------------------------------------------------------- Media
export const mediaRepository = {
  async list(query: ListQuery<'createdAt' | 'name' | 'sizeBytes'> & { kind?: MediaKind | 'all' }) {
    return applyListQuery(
      DEMO_MEDIA,
      query,
      {
        searchIn: (m: MediaAsset) => [m.name],
        filter: (m) => !query.kind || query.kind === 'all' || m.kind === query.kind,
        sortValue: (m, key) => m[key],
      },
      IS_DEMO,
    );
  },
};

// ---------------------------------------------------------------- Dashboard
export const dashboardRepository = {
  async summary(): Promise<DashboardSummary> {
    return DEMO_DASHBOARD;
  },
  async activities(): Promise<ActivityItem[]> {
    return DEMO_ACTIVITIES;
  },
  async recentJobs(): Promise<VideoJob[]> {
    return [...DEMO_VIDEO_JOBS].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  },
};

// ---------------------------------------------------------------- Scripts
export const scriptRepository = {
  /** Kịch bản MẪU – không gọi AI. */
  async demoScript(productName: string, durationSec: number): Promise<GeneratedScript> {
    return buildDemoScript(productName, durationSec);
  },
};
