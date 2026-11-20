import { z } from 'zod';
import { paginationQuerySchema } from '../pagination';
import { mediaAssetSchema } from './media';

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

// ------------------------------------------------------------------ Provider
/** Provider AI tạo ảnh. Mode F dùng bộ ghép ảnh "composition" (không phải AI, không nằm trong danh sách này). */
export const IMAGE_PROVIDER_IDS = ['gemini', 'openai', 'mock'] as const;
export type ImageProviderId = (typeof IMAGE_PROVIDER_IDS)[number];
export const COMPOSITION_ENGINE_ID = 'composition' as const;

export const imageProviderModelSchema = z.object({
  id: z.string(),
  label: z.string(),
  pricePerImageUsd: z.string().nullable(),
  pricingKnown: z.boolean(),
  pricingSource: z.string(),
  maxReferenceImages: z.number().int(),
  nativeAspects: z.array(z.enum(IMAGE_ASPECTS)),
  negativePrompt: z.boolean(),
  resolution: z.string(),
  notes: z.array(z.string()),
});
export type ImageProviderModel = z.infer<typeof imageProviderModelSchema>;

export const imageProviderStatusSchema = z.object({
  id: z.enum(IMAGE_PROVIDER_IDS),
  displayName: z.string(),
  isMock: z.boolean(),
  status: z.enum(['ready', 'not_configured', 'disabled']),
  message: z.string(),
  envVars: z.array(z.string()),
  defaultModel: z.string().nullable(),
  models: z.array(imageProviderModelSchema),
});
export type ImageProviderStatus = z.infer<typeof imageProviderStatusSchema>;

export const imageProvidersResponseSchema = z.object({
  defaultProvider: z.enum(IMAGE_PROVIDER_IDS).nullable(),
  providers: z.array(imageProviderStatusSchema),
});
export type ImageProvidersResponse = z.infer<typeof imageProvidersResponseSchema>;

export const imageProviderCheckSchema = z.object({
  id: z.enum(IMAGE_PROVIDER_IDS),
  ok: z.boolean(),
  message: z.string(),
  model: z.string().nullable(),
  checkedAt: z.iso.datetime(),
});
export type ImageProviderCheck = z.infer<typeof imageProviderCheckSchema>;

// ------------------------------------------------------------------ Job & item
export const IMAGE_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'WAITING_PROVIDER',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type ImageJobStatus = (typeof IMAGE_JOB_STATUSES)[number];
export const IMAGE_JOB_ACTIVE_STATUSES: readonly ImageJobStatus[] = [
  'QUEUED',
  'RUNNING',
  'WAITING_PROVIDER',
];

/** Giai đoạn xử lý (hiển thị thay cho phần trăm – provider không trả tiến độ %). */
export const IMAGE_ITEM_STAGES = [
  'queued',
  'loading_references',
  'calling_provider',
  'post_processing',
  'saving',
  'done',
  'failed',
  'cancelled',
] as const;
export type ImageItemStage = (typeof IMAGE_ITEM_STAGES)[number];

export const IMAGE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type ImageApprovalStatus = (typeof IMAGE_APPROVAL_STATUSES)[number];

/** Cờ người duyệt gắn khi ảnh có nguy cơ sai sản phẩm. */
export const IMAGE_REVIEW_FLAGS = [
  'color_mismatch',
  'pattern_mismatch',
  'shape_mismatch',
  'wrong_item_count',
  'extra_items',
  'distorted',
  'text_artifacts',
  'other',
] as const;
export type ImageReviewFlag = (typeof IMAGE_REVIEW_FLAGS)[number];
export const IMAGE_REVIEW_FLAG_LABEL: Record<ImageReviewFlag, string> = {
  color_mismatch: 'Sai màu',
  pattern_mismatch: 'Sai họa tiết/hoa văn',
  shape_mismatch: 'Sai hình dáng/cấu trúc',
  wrong_item_count: 'Sai số lượng thành phần',
  extra_items: 'Thêm vật phẩm dễ nhầm là đi kèm',
  distorted: 'Méo/tỷ lệ bất thường',
  text_artifacts: 'Có chữ/logo lạ',
  other: 'Lý do khác',
};

export const imageGenerateRequestSchema = z
  .object({
    productId: z.uuid('Sản phẩm không hợp lệ'),
    referenceAssetIds: z
      .array(z.uuid())
      .min(1, 'Chọn ít nhất 1 ảnh tham chiếu của sản phẩm')
      .max(10, 'Tối đa 10 ảnh tham chiếu'),
    mode: z.enum(IMAGE_MODES),
    templateId: z.string().min(1).max(60),
    styleId: z.string().max(60).nullish(),
    aspect: z.enum(IMAGE_ASPECTS).default(DEFAULT_IMAGE_ASPECT),
    count: z.union([z.literal(1), z.literal(3), z.literal(5)]).default(1),
    provider: z.enum(IMAGE_PROVIDER_IDS).nullish(),
    model: z.string().max(100).nullish(),
    userPrompt: z.string().max(1000, 'Prompt tối đa 1000 ký tự').nullish(),
    /** Mode F: màu nền (hex) */
    backgroundColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Màu nền dạng #RRGGBB')
      .nullish(),
    /** Client sinh 1 lần cho mỗi lần bấm "Tạo" – gửi lại (refresh/double-click) không tạo job trùng */
    idempotencyKey: z.uuid('Thiếu idempotencyKey'),
  })
  .strict();
export type ImageGenerateRequest = z.infer<typeof imageGenerateRequestSchema>;
export type ImageGenerateRequestInput = z.input<typeof imageGenerateRequestSchema>;

export const imageEstimateRequestSchema = imageGenerateRequestSchema
  .omit({ idempotencyKey: true })
  .extend({ idempotencyKey: z.uuid().optional() });

export const imageEstimateSchema = z.object({
  usesAi: z.boolean(),
  provider: z.string(),
  model: z.string(),
  isMock: z.boolean(),
  count: z.number().int(),
  pricePerImageUsd: z.string().nullable(),
  estimatedCostUsd: z.string().nullable(),
  pricingKnown: z.boolean(),
  pricingSource: z.string(),
  allowed: z.boolean(),
  reason: z.string().nullable(),
  remainingDailyUsd: z.string(),
  /** Prompt dự kiến cho ảnh đầu tiên (để người dùng xem trước) */
  promptPreview: imagePromptSchema.nullable(),
  /** Cách xử lý tỷ lệ nếu provider không tạo trực tiếp */
  aspectHandling: z.enum(['native', 'pad']),
});
export type ImageEstimate = z.infer<typeof imageEstimateSchema>;

export const imageFitSchema = z.object({
  mode: z.enum(['none', 'pad']),
  providerWidth: z.number().int(),
  providerHeight: z.number().int(),
  finalWidth: z.number().int(),
  finalHeight: z.number().int(),
});

/** Kiểm tra TỰ ĐỘNG (tham khảo) – KHÔNG bảo đảm giữ đúng sản phẩm. */
export const imageAutoCheckSchema = z.object({
  /** Tỷ lệ màu chủ đạo của ảnh gốc xuất hiện trong ảnh mới (0–1); null nếu không tính được */
  colorCoverage: z.number().min(0).max(1).nullable(),
  referencePalette: z.array(z.string()),
  outputPalette: z.array(z.string()),
  fit: imageFitSchema,
  /** Ghi chú tiếng Việt (vd "đã thêm viền để đúng tỷ lệ") */
  notes: z.array(z.string()),
  /** Cờ tự động: color_low | aspect_padded | provider_note */
  flags: z.array(z.string()),
  method: z.string(),
});
export type ImageAutoCheck = z.infer<typeof imageAutoCheckSchema>;

export const imageItemSchema = z.object({
  id: z.uuid(),
  jobId: z.uuid(),
  index: z.number().int(),
  status: z.enum(IMAGE_JOB_STATUSES),
  stage: z.enum(IMAGE_ITEM_STAGES),
  attempts: z.number().int(),
  prompt: z.string().nullable(),
  preserveRules: z.array(z.string()),
  allowedChanges: z.array(z.string()),
  warnings: z.array(z.string()),
  variationIndex: z.number().int(),
  asset: mediaAssetSchema.nullable(),
  approvalStatus: z.enum(IMAGE_APPROVAL_STATUSES),
  reviewNote: z.string().nullable(),
  reviewFlags: z.array(z.enum(IMAGE_REVIEW_FLAGS)),
  reviewedAt: z.iso.datetime().nullable(),
  autoCheck: imageAutoCheckSchema.nullable(),
  savedToLibrary: z.boolean(),
  linkedToProduct: z.boolean(),
  regeneratedFromId: z.uuid().nullable(),
  estimatedCostUsd: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type ImageItem = z.infer<typeof imageItemSchema>;

export const imageJobCountsSchema = z.object({
  total: z.number().int(),
  queued: z.number().int(),
  running: z.number().int(),
  completed: z.number().int(),
  failed: z.number().int(),
  cancelled: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
});

export const imageJobSchema = z.object({
  id: z.uuid(),
  productId: z.uuid().nullable(),
  productName: z.string(),
  mode: z.enum(IMAGE_MODES),
  usesAi: z.boolean(),
  templateId: z.string(),
  templateName: z.string(),
  templateVersion: z.string(),
  styleId: z.string().nullable(),
  aspect: z.enum(IMAGE_ASPECTS),
  requestedCount: z.number().int(),
  provider: z.string(),
  model: z.string(),
  isMock: z.boolean(),
  userPrompt: z.string().nullable(),
  status: z.enum(IMAGE_JOB_STATUSES),
  counts: imageJobCountsSchema,
  estimatedCostUsd: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
});
export type ImageJob = z.infer<typeof imageJobSchema>;

export const imageJobDetailSchema = imageJobSchema.extend({
  references: z.array(mediaAssetSchema),
  items: z.array(imageItemSchema),
  visualContext: productVisualContextSchema.nullable(),
});
export type ImageJobDetail = z.infer<typeof imageJobDetailSchema>;

export const imageJobListQuerySchema = paginationQuerySchema.extend({
  productId: z
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  status: z
    .enum(IMAGE_JOB_STATUSES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
export type ImageJobListQuery = z.infer<typeof imageJobListQuerySchema>;

export const imageReviewSchema = z
  .object({
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').nullish(),
    flags: z.array(z.enum(IMAGE_REVIEW_FLAGS)).max(IMAGE_REVIEW_FLAGS.length).default([]),
  })
  .strict();
export type ImageReviewInput = z.infer<typeof imageReviewSchema>;

/** Ngữ cảnh ảnh của sản phẩm cho UI: dữ kiện thị giác + ảnh tham chiếu + template phù hợp */
export const imageProductContextSchema = z.object({
  visualContext: productVisualContextSchema,
  references: z.array(mediaAssetSchema),
  templates: z.array(imageTemplateMatchSchema),
});
export type ImageProductContext = z.infer<typeof imageProductContextSchema>;
