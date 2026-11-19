/**
 * DANH MỤC CẤU HÌNH TĨNH (không phải dữ liệu demo): giọng đọc, template video/ảnh,
 * prompt mẫu, phong cách kịch bản… Sẽ chuyển sang cấu hình từ server khi có provider (Phase 03–06).
 */
export interface Voice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  region: 'bac' | 'trung' | 'nam';
}
export const VOICES: Voice[] = [
  { id: 'vi-female-north-1', name: 'Mai – Nữ miền Bắc', gender: 'female', region: 'bac' },
  { id: 'vi-male-north-1', name: 'Minh – Nam miền Bắc', gender: 'male', region: 'bac' },
  { id: 'vi-female-south-1', name: 'Thảo – Nữ miền Nam', gender: 'female', region: 'nam' },
  { id: 'vi-male-south-1', name: 'Khoa – Nam miền Nam', gender: 'male', region: 'nam' },
  { id: 'vi-female-central-1', name: 'Hương – Nữ miền Trung', gender: 'female', region: 'trung' },
];

export const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

export const VIDEO_TEMPLATES = [
  { id: 'tpl-fast-cut', name: 'Cắt nhanh – năng động' },
  { id: 'tpl-elegant', name: 'Thanh lịch – chuyển cảnh mềm' },
  { id: 'tpl-review', name: 'Review cận cảnh' },
  { id: 'tpl-sale', name: 'Flash sale – chữ lớn' },
] as const;

export const templateName = (id: string) => VIDEO_TEMPLATES.find((t) => t.id === id)?.name ?? id;

export const PROMPT_CATEGORIES = [
  { id: 'fashion', name: 'Thời trang' },
  { id: 'cosmetics', name: 'Mỹ phẩm' },
  { id: 'furniture', name: 'Nội thất' },
  { id: 'food', name: 'Ẩm thực' },
  { id: 'review', name: 'Review sản phẩm' },
  { id: 'sales', name: 'Quảng cáo bán hàng' },
] as const;

export type PromptCategoryId = (typeof PROMPT_CATEGORIES)[number]['id'];

export interface PromptTemplate {
  id: string;
  categoryId: PromptCategoryId;
  name: string;
  content: string;
}

export const VIDEO_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'p-fashion-1',
    categoryId: 'fashion',
    name: 'Phối đồ dạo phố',
    content:
      'Video {duration} giây giới thiệu {product}. Mở đầu bằng câu hỏi gây tò mò về cách phối đồ, cận cảnh chất liệu, 3 cách phối khác nhau, kết thúc bằng lời kêu gọi đặt hàng. Giọng văn trẻ trung, gần gũi.',
  },
  {
    id: 'p-cosmetics-1',
    categoryId: 'cosmetics',
    name: 'Trước – sau khi dùng',
    content:
      'Video {duration} giây cho {product}: nêu vấn đề làn da thường gặp, cận cảnh kết cấu sản phẩm, các bước sử dụng, cảm nhận sau khi dùng. Tránh tuyên bố y khoa. Kết thúc bằng ưu đãi.',
  },
  {
    id: 'p-furniture-1',
    categoryId: 'furniture',
    name: 'Không gian sống',
    content:
      'Video {duration} giây giới thiệu {product} trong không gian phòng khách hiện đại, ánh sáng tự nhiên, nhấn mạnh kích thước, chất liệu và tính tiện dụng.',
  },
  {
    id: 'p-food-1',
    categoryId: 'food',
    name: 'Hấp dẫn vị giác',
    content:
      'Video {duration} giây về {product}: cận cảnh món ăn, âm thanh sống động, mô tả hương vị, cách thưởng thức và thông tin giao hàng.',
  },
  {
    id: 'p-review-1',
    categoryId: 'review',
    name: 'Review trung thực',
    content:
      'Video {duration} giây review {product}: mở hộp, 3 điểm nổi bật, 1 điểm cần lưu ý, đánh giá tổng quan, phù hợp với ai.',
  },
  {
    id: 'p-sales-1',
    categoryId: 'sales',
    name: 'Chốt đơn nhanh',
    content:
      'Video {duration} giây quảng cáo {product}: hook mạnh 3 giây đầu, lợi ích chính, giá ưu đãi, số lượng có hạn, kêu gọi bấm giỏ hàng ngay.',
  },
];

export const DEFAULT_VIDEO_PROMPT = VIDEO_PROMPT_TEMPLATES[5]!.content;

// Phong cách / giọng văn / đối tượng kịch bản: lấy từ API (/scripts/templates) và @acs/shared (Phase 03)

export const IMAGE_TEMPLATES = [
  { id: 'ad', name: 'Ảnh quảng cáo sản phẩm', hint: 'Nền sạch, chữ nổi bật' },
  { id: 'background', name: 'Thay đổi bối cảnh', hint: 'Giữ sản phẩm, đổi phông' },
  { id: 'lifestyle', name: 'Lifestyle', hint: 'Sản phẩm trong đời sống' },
  { id: 'model', name: 'Người mẫu thời trang', hint: 'Người mẫu mặc/cầm sản phẩm' },
  { id: 'studio', name: 'Ảnh studio', hint: 'Ánh sáng studio chuyên nghiệp' },
  { id: 'luxury', name: 'Ảnh sản phẩm cao cấp', hint: 'Tông tối, sang trọng' },
] as const;

/** Placeholder: chưa có provider nào được cấu hình ở Phase 01. */
export const AI_PROVIDER_PLACEHOLDERS = [
  { id: 'image-provider-a', name: 'Nhà cung cấp ảnh A (chưa cấu hình)' },
  { id: 'image-provider-b', name: 'Nhà cung cấp ảnh B (chưa cấu hình)' },
] as const;
