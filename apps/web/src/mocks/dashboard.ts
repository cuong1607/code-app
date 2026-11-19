/** DỮ LIỆU DEMO – số liệu tổng quan & hoạt động gần đây. */
import { RUNNING_VIDEO_STATUSES } from '@acs/shared';
import type { ActivityItem, DashboardSummary } from '@/types/domain';
import { DEMO_PRODUCTS } from './products';
import { DEMO_NOW, minutesAgo } from './rng';
import { DEMO_VIDEO_JOBS } from './video-jobs';

const DAILY = [6, 9, 4, 12, 15, 11, 18, 14, 21, 17, 24, 19, 27, 23];

export const DEMO_DASHBOARD: DashboardSummary = {
  productCount: DEMO_PRODUCTS.length,
  imageCount: DEMO_PRODUCTS.reduce((sum, p) => sum + p.images.length, 0),
  videoCount: DEMO_VIDEO_JOBS.length,
  videoCompleted: DEMO_VIDEO_JOBS.filter((j) => j.status === 'completed').length,
  videoProcessing: DEMO_VIDEO_JOBS.filter((j) => RUNNING_VIDEO_STATUSES.includes(j.status)).length,
  videoFailed: DEMO_VIDEO_JOBS.filter((j) => j.status === 'failed').length,
  batchCount: new Set(DEMO_VIDEO_JOBS.map((j) => j.batchId)).size,
  estimatedAiCostUsd: 12.4,
  videosPerDay: DAILY.map((count, i) => ({
    date: new Date(DEMO_NOW - (DAILY.length - 1 - i) * 86_400_000).toISOString(),
    count,
  })),
  isDemo: true,
};

export const DEMO_ACTIVITIES: ActivityItem[] = [
  {
    id: 'a1',
    kind: 'video',
    message: 'Video "Áo thun cotton oversize · bản 1" đã hoàn thành',
    at: minutesAgo(8),
  },
  {
    id: 'a2',
    kind: 'publish',
    message: 'Lên lịch 3 video cho @cuahangmau.official',
    at: minutesAgo(25),
  },
  {
    id: 'a3',
    kind: 'video',
    message: 'Batch 2 thất bại 1 tác vụ: hết hạn mức giọng đọc',
    at: minutesAgo(52),
  },
  {
    id: 'a4',
    kind: 'script',
    message: 'Tạo 3 biến thể kịch bản cho "Serum vitamin C 30ml"',
    at: minutesAgo(95),
  },
  {
    id: 'a5',
    kind: 'product',
    message: 'Thêm 4 sản phẩm mới vào danh mục Gia dụng',
    at: minutesAgo(180),
  },
  {
    id: 'a6',
    kind: 'image',
    message: 'Tạo 8 ảnh lifestyle cho "Đèn bàn gốm thủ công"',
    at: minutesAgo(260),
  },
].map((item) => ({ ...item, kind: item.kind as ActivityItem['kind'], isDemo: true }));
