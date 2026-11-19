/**
 * Nhãn tiếng Việt & tone màu cho mọi enum trạng thái.
 * Tập trung tại đây để màu trạng thái thống nhất toàn hệ thống.
 */
import type {
  AspectRatio,
  MediaKind,
  MediaSourceType,
  ProductSourceType,
  ProductStatus,
  PublishMode,
  PublishStatus,
  SceneType,
  ScriptOrigin,
  ScriptValidationStatus,
  VideoJobStatus,
  VideoMode,
  VisualSource,
} from '@acs/shared';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'processing' | 'neutral';

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const PRODUCT_STATUS_META: Record<ProductStatus, StatusMeta> = {
  draft: { label: 'Bản nháp', tone: 'neutral' },
  active: { label: 'Đang bán', tone: 'success' },
  archived: { label: 'Lưu trữ', tone: 'warning' },
};

export const VIDEO_STATUS_META: Record<VideoJobStatus, StatusMeta> = {
  queued: { label: 'Chờ xử lý', tone: 'neutral' },
  scripting: { label: 'Đang tạo kịch bản', tone: 'processing' },
  voicing: { label: 'Đang tạo giọng đọc', tone: 'processing' },
  imaging: { label: 'Đang tạo ảnh', tone: 'processing' },
  rendering: { label: 'Đang dựng video', tone: 'info' },
  completed: { label: 'Hoàn thành', tone: 'success' },
  failed: { label: 'Thất bại', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'warning' },
};

export const PUBLISH_STATUS_META: Record<PublishStatus, StatusMeta> = {
  pending_review: { label: 'Chờ kiểm duyệt', tone: 'warning' },
  scheduled: { label: 'Đã lên lịch', tone: 'info' },
  processing: { label: 'Đang xử lý', tone: 'processing' },
  published: { label: 'Đã đăng', tone: 'success' },
  failed: { label: 'Thất bại', tone: 'danger' },
};

export const PUBLISH_MODE_LABEL: Record<PublishMode, string> = {
  immediate: 'Đăng ngay',
  scheduled: 'Hẹn giờ',
  draft: 'Lưu nháp TikTok',
};

export const VIDEO_MODE_META: Record<
  VideoMode,
  { label: string; description: string; availability: string }
> = {
  image_slideshow: {
    label: 'Video từ ảnh',
    description: 'Ghép ảnh sản phẩm + giọng đọc + phụ đề bằng FFmpeg',
    availability: 'Dự kiến Phase 06',
  },
  ai_image_to_video: {
    label: 'AI Image-to-Video',
    description: 'Dùng AI biến ảnh tĩnh thành chuyển động',
    availability: 'Chưa khả dụng – cần AI video provider',
  },
  hybrid: {
    label: 'Hybrid Video',
    description: 'Kết hợp cảnh AI và cảnh dựng từ ảnh',
    availability: 'Chưa khả dụng – cần AI video provider',
  },
};

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  ORIGINAL_IMAGE: 'Ảnh sản phẩm',
  AI_IMAGE: 'Ảnh AI',
  VIDEO: 'Video',
  AUDIO: 'Âm thanh',
  THUMBNAIL: 'Thumbnail',
};

export const PRODUCT_SOURCE_LABEL: Record<ProductSourceType, string> = {
  manual: 'Nhập thủ công',
  import_csv: 'Import CSV',
  import_xlsx: 'Import Excel',
  seed: 'Dữ liệu MẪU (seed)',
};

export const MEDIA_SOURCE_LABEL: Record<MediaSourceType, string> = {
  upload: 'Tải lên',
  import_url: 'Tải từ URL',
  generated: 'Do AI tạo',
  seed: 'Dữ liệu mẫu',
};

export const ASPECT_RATIO_LABEL: Record<AspectRatio, string> = {
  '9:16': '9:16 · Dọc (TikTok/Reels)',
  '1:1': '1:1 · Vuông',
  '4:5': '4:5 · Dọc ngắn',
  '16:9': '16:9 · Ngang',
};

/** Class Tailwind cho chấm màu theo tone (dùng trong biểu đồ, chú giải). */
export const TONE_DOT_CLASS: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  processing: 'bg-processing',
  neutral: 'bg-neutral/60',
};

// ---------------------------------------------------------------- AI Script Engine (Phase 03)
export const SCRIPT_VALIDATION_META: Record<ScriptValidationStatus, StatusMeta> = {
  valid: { label: 'Hợp lệ', tone: 'success' },
  warnings: { label: 'Có cảnh báo', tone: 'warning' },
  invalid: { label: 'Cần sửa', tone: 'danger' },
  unchecked: { label: 'Chưa kiểm tra', tone: 'neutral' },
};

export const SCRIPT_ORIGIN_LABEL: Record<ScriptOrigin, string> = {
  ai: 'AI tạo',
  manual: 'Sửa thủ công',
  sample: 'Từ khuôn mẫu',
  legacy: 'Bản nháp Phase 02',
};

export const SCENE_TYPE_LABEL: Record<SceneType, string> = {
  HOOK: 'Hook',
  PROBLEM: 'Vấn đề',
  INTRO: 'Giới thiệu',
  FEATURE: 'Đặc điểm',
  DEMO: 'Trình diễn',
  BENEFIT: 'Lợi ích',
  STORY: 'Câu chuyện',
  COMPARISON: 'So sánh',
  CTA: 'Kêu gọi (CTA)',
};

export const VISUAL_SOURCE_LABEL: Record<VisualSource, string> = {
  PRODUCT_IMAGE: 'Ảnh sản phẩm thật',
  AI_GENERATED_IMAGE: 'Ảnh AI',
  AI_GENERATED_VIDEO: 'Video AI',
  STOCK_ASSET: 'Tư liệu stock',
  CUSTOM_UPLOAD: 'Tự tải lên',
};

export const PROVIDER_STATUS_META: Record<'ready' | 'not_configured' | 'disabled', StatusMeta> = {
  ready: { label: 'Đã cấu hình', tone: 'success' },
  not_configured: { label: 'Chưa cấu hình', tone: 'neutral' },
  disabled: { label: 'Đã tắt', tone: 'neutral' },
};

export const AI_FEATURE_LABEL: Record<string, string> = {
  script_generate: 'Tạo kịch bản',
  scene_regenerate: 'Tạo lại cảnh',
  caption_generate: 'Tạo caption',
  provider_check: 'Kiểm tra kết nối',
};

export const AI_USAGE_STATUS_META: Record<string, StatusMeta> = {
  success: { label: 'Thành công', tone: 'success' },
  failed: { label: 'Lỗi', tone: 'danger' },
  invalid_output: { label: 'Output sai', tone: 'warning' },
  refused: { label: 'Bị từ chối', tone: 'warning' },
  rejected_budget: { label: 'Chặn bởi ngân sách', tone: 'neutral' },
};
