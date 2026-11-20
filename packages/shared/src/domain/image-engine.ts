import { z } from 'zod';

/**
 * AI IMAGE STUDIO – NHÀ CỬA & ĐỜI SỐNG (Phase 04) – schema dùng chung giữa API, worker và web.
 *
 * Nguyên tắc: ảnh AI phải CỐ GẮNG giữ đúng sản phẩm (màu, hoa văn, cấu trúc, số lượng thành phần).
 * AI KHÔNG bảo đảm điều đó – mọi ảnh phải được người dùng so sánh với ảnh gốc và duyệt.
 */

// ------------------------------------------------------------------ Nhóm ngành Home & Living
/** Nhóm sản phẩm lớn – quyết định template nào áp dụng được. */
export const HOME_LIVING_GROUPS = ['bedding', 'mat', 'rug', 'textile'] as const;
export type HomeLivingGroup = (typeof HOME_LIVING_GROUPS)[number];

/** Loại sản phẩm cụ thể. */
export const HOME_LIVING_KINDS = [
  'bedding_set', // bộ chăn ga gối / bộ ga gối
  'blanket', // chăn (hè, đông, lông, mỏng…)
  'bed_sheet', // ga trải giường
  'pillowcase', // vỏ gối
  'pillow', // ruột gối / gối
  'sleeping_mat', // chiếu (điều hoà, cói, trúc…)
  'living_room_rug', // thảm phòng khách
  'bedroom_rug', // thảm phòng ngủ
  'bed_rug', // thảm trải giường
  'doormat', // thảm chùi chân
  'rug', // thảm chưa rõ vị trí
  'other_textile', // sản phẩm dệt gia dụng khác
] as const;
export type HomeLivingKind = (typeof HOME_LIVING_KINDS)[number];

export const HOME_LIVING_KIND_GROUP: Record<HomeLivingKind, HomeLivingGroup> = {
  bedding_set: 'bedding',
  blanket: 'bedding',
  bed_sheet: 'bedding',
  pillowcase: 'bedding',
  pillow: 'bedding',
  sleeping_mat: 'mat',
  living_room_rug: 'rug',
  bedroom_rug: 'rug',
  bed_rug: 'rug',
  doormat: 'rug',
  rug: 'rug',
  other_textile: 'textile',
};

export const HOME_LIVING_KIND_LABEL: Record<HomeLivingKind, string> = {
  bedding_set: 'Bộ chăn ga gối',
  blanket: 'Chăn',
  bed_sheet: 'Ga trải giường',
  pillowcase: 'Vỏ gối',
  pillow: 'Gối',
  sleeping_mat: 'Chiếu',
  living_room_rug: 'Thảm phòng khách',
  bedroom_rug: 'Thảm phòng ngủ',
  bed_rug: 'Thảm trải giường',
  doormat: 'Thảm chùi chân',
  rug: 'Thảm',
  other_textile: 'Sản phẩm dệt gia dụng',
};

export const HOME_LIVING_GROUP_LABEL: Record<HomeLivingGroup, string> = {
  bedding: 'Chăn, ga, gối',
  mat: 'Chiếu',
  rug: 'Thảm',
  textile: 'Dệt gia dụng khác',
};

// ------------------------------------------------------------------ Product Visual Context
/** Các trường thị giác có thể lấy từ dữ liệu sản phẩm. */
export const VISUAL_FACT_FIELDS = [
  'color',
  'pattern',
  'material',
  'size',
  'shape',
  'setComposition',
  'thickness',
  'placement',
  'interiorStyle',
  'subtype',
] as const;
export type VisualFactField = (typeof VISUAL_FACT_FIELDS)[number];

export const VISUAL_FACT_LABEL: Record<VisualFactField, string> = {
  color: 'Màu sắc',
  pattern: 'Họa tiết',
  material: 'Chất liệu',
  size: 'Kích thước',
  shape: 'Hình dáng',
  setComposition: 'Thành phần bộ',
  thickness: 'Độ dày',
  placement: 'Vị trí sử dụng',
  interiorStyle: 'Phong cách nội thất gợi ý',
  subtype: 'Loại cụ thể',
};

/** Nguồn của một dữ kiện – KHÔNG có nguồn "AI phân tích ảnh" cho tới khi có bước phân tích thật. */
export const VISUAL_FACT_SOURCES = ['attribute', 'category', 'name', 'user'] as const;
export type VisualFactSource = (typeof VISUAL_FACT_SOURCES)[number];

export const visualFactSchema = z.object({
  field: z.enum(VISUAL_FACT_FIELDS),
  value: z.string(),
  source: z.enum(VISUAL_FACT_SOURCES),
  /** Tên thuộc tính gốc trong DB (khi source = attribute) */
  sourceKey: z.string().nullable(),
});
export type VisualFact = z.infer<typeof visualFactSchema>;

export const itemCountSchema = z.object({
  /** "pillowcase" | "bed_sheet" | "duvet_cover" | "blanket" | "bolster_case" | "pillow" */
  item: z.string(),
  label: z.string(),
  count: z.number().int().positive(),
});
export type ItemCount = z.infer<typeof itemCountSchema>;

export const productVisualContextSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  category: z.string(),
  kind: z.enum(HOME_LIVING_KINDS).nullable(),
  group: z.enum(HOME_LIVING_GROUPS).nullable(),
  /** Loại được nhận diện từ đâu (null = không nhận diện được -> chỉ dùng template chung) */
  kindSource: z.enum(['category', 'name', 'attribute']).nullable(),
  facts: z.array(visualFactSchema),
  /** Số lượng thành phần đọc được từ thuộc tính "Bộ gồm"/"Thành phần" (không suy đoán) */
  itemCounts: z.array(itemCountSchema),
  /** Các trường quan trọng với nhóm ngành nhưng CHƯA có dữ liệu */
  missing: z.array(z.enum(VISUAL_FACT_FIELDS)),
  /** Luôn 'none' ở Phase 04: chưa có bước AI phân tích ảnh thật */
  imageAnalysis: z.literal('none'),
});
export type ProductVisualContext = z.infer<typeof productVisualContextSchema>;

/** Trường quan trọng theo nhóm – thiếu thì cảnh báo (không tự điền). */
export const IMPORTANT_FACTS_BY_GROUP: Record<HomeLivingGroup, readonly VisualFactField[]> = {
  bedding: ['color', 'pattern', 'size', 'setComposition'],
  rug: ['color', 'pattern', 'size', 'shape', 'material'],
  mat: ['color', 'pattern', 'size', 'material'],
  textile: ['color', 'pattern'],
};

// ------------------------------------------------------------------ Chế độ, tỷ lệ, số lượng
export const IMAGE_MODES = [
  'product_background', // A – giữ sản phẩm, thay nền/bối cảnh
  'lifestyle_interior', // B – đặt vào không gian nội thất
  'product_ad', // C – bố cục quảng cáo, chừa chỗ chèn chữ
  'product_detail', // D – cận chi tiết
  'batch_variations', // E – nhiều bối cảnh khác nhau
  'original_composition', // F – ghép ảnh gốc bằng xử lý ảnh truyền thống (KHÔNG phải AI)
] as const;
export type ImageMode = (typeof IMAGE_MODES)[number];

export const IMAGE_MODE_META: Record<
  ImageMode,
  { letter: string; label: string; description: string; usesAi: boolean }
> = {
  product_background: {
    letter: 'A',
    label: 'Thay nền sản phẩm',
    description: 'Giữ sản phẩm làm chủ thể, chỉ thay nền/bối cảnh.',
    usesAi: true,
  },
  lifestyle_interior: {
    letter: 'B',
    label: 'Không gian nội thất',
    description: 'Đặt sản phẩm vào phòng ngủ, phòng khách hoặc không gian phù hợp.',
    usesAi: true,
  },
  product_ad: {
    letter: 'C',
    label: 'Ảnh quảng cáo',
    description: 'Bố cục quảng cáo, chừa vùng trống để chèn tiêu đề/CTA sau.',
    usesAi: true,
  },
  product_detail: {
    letter: 'D',
    label: 'Cận chi tiết',
    description: 'Cận bề mặt, đường may, hoa văn dựa trên ảnh tham chiếu.',
    usesAi: true,
  },
  batch_variations: {
    letter: 'E',
    label: 'Nhiều biến thể',
    description: 'Nhiều ảnh với bối cảnh khác nhau từ cùng một bộ ảnh sản phẩm.',
    usesAi: true,
  },
  original_composition: {
    letter: 'F',
    label: 'Ghép ảnh gốc (không AI)',
    description:
      'Đặt nguyên ảnh sản phẩm gốc lên nền bằng xử lý ảnh truyền thống – giữ tuyệt đối chi tiết, KHÔNG phải ảnh AI.',
    usesAi: false,
  },
};

export const IMAGE_ASPECTS = ['1:1', '4:5', '9:16', '16:9'] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
/** Ưu tiên 9:16 cho video TikTok */
export const DEFAULT_IMAGE_ASPECT: ImageAspect = '9:16';

export const IMAGE_COUNTS = [1, 3, 5] as const;
export type ImageCount = (typeof IMAGE_COUNTS)[number];

// ------------------------------------------------------------------ Phong cách hình ảnh
export interface ImageStyleOption {
  id: string;
  label: string;
  /** Mô tả tiếng Anh đưa vào prompt ảnh */
  prompt: string;
}

export const IMAGE_STYLES: readonly ImageStyleOption[] = [
  {
    id: 'natural_daylight',
    label: 'Ánh sáng tự nhiên',
    prompt: 'soft natural daylight from a window, true-to-life colors',
  },
  {
    id: 'warm_cozy',
    label: 'Ấm áp, dịu nhẹ',
    prompt: 'warm soft ambient light, gentle shadows, inviting mood',
  },
  {
    id: 'bright_airy',
    label: 'Sáng, thoáng',
    prompt: 'bright airy high-key lighting, light neutral surroundings',
  },
  {
    id: 'premium_editorial',
    label: 'Sang trọng kiểu tạp chí',
    prompt: 'premium editorial interior photography, refined composition, subtle contrast',
  },
  {
    id: 'clean_commercial',
    label: 'Thương mại điện tử',
    prompt: 'clean commercial e-commerce photography, even diffused lighting',
  },
];

// ------------------------------------------------------------------ Template ảnh
export const REFERENCE_KINDS = ['full_product', 'detail', 'any'] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const REFERENCE_KIND_LABEL: Record<ReferenceKind, string> = {
  full_product: 'Ảnh toàn bộ sản phẩm',
  detail: 'Ảnh cận chất liệu/hoa văn',
  any: 'Ảnh sản phẩm bất kỳ',
};

export const imageTemplateSchema = z.object({
  id: z.string(),
  /** Số thứ tự hiển thị "Template 01" */
  code: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  /** Nhóm sản phẩm áp dụng */
  groups: z.array(z.enum(HOME_LIVING_GROUPS)),
  /** Loại cụ thể bị loại trừ (vd thảm chùi chân không hợp phòng ngủ sang trọng) */
  excludeKinds: z.array(z.enum(HOME_LIVING_KINDS)),
  /** Loại sản phẩm nên gợi ý template này đầu tiên */
  recommendedKinds: z.array(z.enum(HOME_LIVING_KINDS)),
  /** Template chung – dùng được cả khi không nhận diện được loại sản phẩm */
  generic: z.boolean(),
  modes: z.array(z.enum(IMAGE_MODES)),
  /** Prompt cơ sở (tiếng Anh, cho model ảnh) */
  basePrompt: z.string(),
  /** Ràng buộc "không được" – đưa vào negative prompt nếu provider hỗ trợ, ngược lại ghi vào prompt */
  negativeConstraints: z.array(z.string()),
  suggestedAspect: z.enum(IMAGE_ASPECTS),
  defaultStyleId: z.string(),
  reference: z.object({
    minImages: z.number().int().min(1),
    preferred: z.enum(REFERENCE_KINDS),
    note: z.string(),
  }),
});
export type ImageTemplate = z.infer<typeof imageTemplateSchema>;

/** Template trả cho UI kèm đánh giá mức phù hợp với sản phẩm đang chọn. */
export const imageTemplateMatchSchema = z.object({
  template: imageTemplateSchema,
  applicable: z.boolean(),
  recommended: z.boolean(),
  /** Lý do không áp dụng (tiếng Việt) */
  reason: z.string().nullable(),
});
export type ImageTemplateMatch = z.infer<typeof imageTemplateMatchSchema>;

// ------------------------------------------------------------------ Kết quả prompt builder
export const IMAGE_PROMPT_BUILDER_VERSION = '1.0.0';

export const imagePromptSchema = z.object({
  /** Prompt đầy đủ gửi cho model ảnh */
  prompt: z.string(),
  /** Chỉ có khi provider hỗ trợ negative prompt riêng */
  negativePrompt: z.string().nullable(),
  preserveRules: z.array(z.string()),
  allowedChanges: z.array(z.string()),
  templateId: z.string(),
  templateVersion: z.string(),
  builderVersion: z.string(),
  mode: z.enum(IMAGE_MODES),
  aspect: z.enum(IMAGE_ASPECTS),
  styleId: z.string(),
  variationIndex: z.number().int().nonnegative(),
  /** Cảnh báo tiếng Việt cho người dùng (vd thiếu màu sắc -> AI chỉ dựa vào ảnh) */
  warnings: z.array(z.string()),
});
export type ImagePrompt = z.infer<typeof imagePromptSchema>;
