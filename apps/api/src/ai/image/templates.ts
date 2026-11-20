import type {
  HomeLivingKind,
  ImageMode,
  ImageTemplate,
  ImageTemplateMatch,
  ProductVisualContext,
} from '@acs/shared';

/**
 * TEMPLATE ẢNH AI – NHÀ CỬA & ĐỜI SỐNG (phiên bản hoá).
 * Đổi nội dung prompt/ràng buộc => tăng `version` để ảnh đã lưu biết được tạo bằng phiên bản nào.
 *
 * `basePrompt` chỉ mô tả BỐI CẢNH. Quy tắc giữ đúng sản phẩm, dữ kiện, tỷ lệ… do prompt builder
 * ghép thêm. `{placement}` được thay bằng cách đặt sản phẩm theo loại (trên giường, trên sàn…).
 */
const BEDROOM_FRIENDLY_EXCLUDE: HomeLivingKind[] = ['living_room_rug', 'doormat'];

/** Ràng buộc chung cho mọi template AI. */
export const COMMON_NEGATIVE_CONSTRAINTS = [
  'changing the product colors or color tones',
  'replacing, simplifying or inventing patterns and prints on the product',
  'changing the product shape, edges or construction',
  'adding extra items that could be mistaken for included products',
  'text, letters, numbers, watermarks or logos that are not on the original product',
  'distorted, warped or unrealistic product proportions',
] as const;

export const IMAGE_TEMPLATES: readonly ImageTemplate[] = [
  {
    id: 'luxury_bedroom',
    code: '01',
    name: 'Phòng ngủ sang trọng',
    description: 'Bộ chăn ga gối trong phòng ngủ sang trọng, ánh sáng tự nhiên, nội thất hiện đại.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug'],
    excludeKinds: BEDROOM_FRIENDLY_EXCLUDE,
    recommendedKinds: ['bedding_set', 'blanket', 'bed_sheet'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A premium lifestyle photograph of the product {placement} in a luxurious modern bedroom: upholstered headboard, elegant bedside tables, tasteful decor, large window with soft natural daylight.',
    negativeConstraints: ['cluttered room', 'harsh direct flash'],
    suggestedAspect: '9:16',
    defaultStyleId: 'premium_editorial',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Nên có ảnh thấy toàn bộ sản phẩm (cả bộ) và một ảnh cận hoa văn.',
    },
  },
  {
    id: 'minimalist_bedroom',
    code: '02',
    name: 'Phòng ngủ tối giản',
    description: 'Phòng ngủ tối giản, màu trung tính, tập trung vào sản phẩm.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug'],
    excludeKinds: BEDROOM_FRIENDLY_EXCLUDE,
    recommendedKinds: ['bedding_set', 'bed_sheet', 'pillowcase', 'blanket'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A minimalist bedroom photograph with the product {placement}: neutral walls, simple low bed frame, very few decorative objects, calm uncluttered composition so the product is the clear focus.',
    negativeConstraints: ['busy decor', 'strong colored lighting'],
    suggestedAspect: '9:16',
    defaultStyleId: 'bright_airy',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Ảnh toàn bộ sản phẩm, chụp rõ màu thật.',
    },
  },
  {
    id: 'cozy_bedroom',
    code: '03',
    name: 'Phòng ngủ ấm cúng',
    description: 'Phòng ngủ ấm cúng, ánh sáng mềm, cảm giác gần gũi.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug'],
    excludeKinds: BEDROOM_FRIENDLY_EXCLUDE,
    recommendedKinds: ['blanket', 'bedding_set', 'bedroom_rug'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A cozy, inviting bedroom photograph with the product {placement}: warm soft lamp light, wooden furniture, a few homely details, relaxed lived-in but tidy atmosphere.',
    negativeConstraints: ['dark underexposed image', 'color cast that alters the product colors'],
    suggestedAspect: '9:16',
    defaultStyleId: 'warm_cozy',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Ảnh toàn bộ sản phẩm; ánh sáng ấm có thể làm màu trông ấm hơn – cần so sánh kỹ.',
    },
  },
  {
    id: 'modern_living_room_rug',
    code: '04',
    name: 'Thảm phòng khách hiện đại',
    description: 'Đặt thảm trong phòng khách hiện đại với sofa và bàn trà.',
    version: '1.0.0',
    groups: ['rug'],
    excludeKinds: ['doormat', 'bed_rug'],
    recommendedKinds: ['living_room_rug', 'rug'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A modern living room interior photograph with the rug {placement}, in front of a contemporary sofa with a coffee table partly on the rug, clean architectural lines, natural daylight.',
    negativeConstraints: [
      'furniture fully covering the rug pattern',
      'rug shown at an impossible size for the room',
    ],
    suggestedAspect: '9:16',
    defaultStyleId: 'natural_daylight',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Ảnh chụp thẳng toàn bộ thảm để AI thấy đủ hoa văn và hình dáng.',
    },
  },
  {
    id: 'scandinavian_interior',
    code: '05',
    name: 'Nội thất Bắc Âu',
    description: 'Phong cách Bắc Âu, tông sáng, ít đồ trang trí.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug', 'textile'],
    excludeKinds: [],
    recommendedKinds: [],
    generic: true,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A Scandinavian interior photograph with the product {placement}: light oak wood, white and soft grey tones, simple functional furniture, a small green plant, minimal decoration.',
    negativeConstraints: ['heavy ornate furniture'],
    suggestedAspect: '9:16',
    defaultStyleId: 'bright_airy',
    reference: { minImages: 1, preferred: 'full_product', note: 'Ảnh toàn bộ sản phẩm.' },
  },
  {
    id: 'product_closeup',
    code: '06',
    name: 'Cận cảnh sản phẩm',
    description: 'Ảnh cận bề mặt, đường may, hoa văn và kết cấu thực tế.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug', 'textile'],
    excludeKinds: [],
    recommendedKinds: [],
    generic: true,
    modes: ['product_detail', 'product_ad'],
    basePrompt:
      'A close-up macro product photograph of the product surface: the textile texture, stitching, edges and the printed or woven pattern, shallow depth of field, soft raking light that reveals texture.',
    negativeConstraints: [
      'inventing texture or weave that is not visible in the reference',
      'invented brand labels',
    ],
    suggestedAspect: '4:5',
    defaultStyleId: 'natural_daylight',
    reference: {
      minImages: 1,
      preferred: 'detail',
      note: 'Cần ảnh cận thật rõ chất liệu/đường may – AI không thể tạo chi tiết không có trong ảnh.',
    },
  },
  {
    id: 'bedding_arrangement',
    code: '07',
    name: 'Sắp xếp bộ chăn ga gối',
    description: 'Bộ chăn ga gối sắp xếp trên giường, thể hiện rõ các thành phần sản phẩm.',
    version: '1.0.0',
    groups: ['bedding'],
    excludeKinds: [],
    recommendedKinds: ['bedding_set', 'pillowcase', 'bed_sheet'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A neatly styled bed photographed from a slightly elevated three-quarter angle, with the product {placement}, arranged so every included component is clearly visible and separated: sheet corners, pillowcases and blanket edges.',
    negativeConstraints: [
      'extra pillows, throws or cushions in different patterns',
      'components hidden under other bedding',
    ],
    suggestedAspect: '9:16',
    defaultStyleId: 'natural_daylight',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Nên có ảnh thấy đủ các thành phần trong bộ; khai báo "Bộ gồm" trong thuộc tính để giữ đúng số lượng.',
    },
  },
  {
    id: 'mat_sleeping_space',
    code: '08',
    name: 'Chiếu & không gian nghỉ ngơi',
    description: 'Chiếu hoặc thảm đặt trong không gian nghỉ ngơi phù hợp.',
    version: '1.0.0',
    groups: ['mat', 'rug'],
    excludeKinds: ['living_room_rug', 'doormat'],
    recommendedKinds: ['sleeping_mat', 'bed_rug', 'bedroom_rug'],
    generic: false,
    modes: ['lifestyle_interior', 'product_background', 'product_ad', 'batch_variations'],
    basePrompt:
      'A calm resting space photograph with the product {placement}: airy bedroom or tatami-style sleeping area, light curtains, cool fresh summer atmosphere, natural daylight.',
    negativeConstraints: ['mat folded so the pattern is hidden'],
    suggestedAspect: '9:16',
    defaultStyleId: 'bright_airy',
    reference: {
      minImages: 1,
      preferred: 'full_product',
      note: 'Ảnh chiếu/thảm trải phẳng, thấy rõ hoa văn và viền.',
    },
  },
  {
    id: 'clean_studio',
    code: '09',
    name: 'Studio nền trơn',
    description: 'Ảnh sản phẩm nền đơn sắc, ánh sáng studio, phục vụ thương mại điện tử.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug', 'textile'],
    excludeKinds: [],
    recommendedKinds: [],
    generic: true,
    modes: ['product_background', 'product_ad', 'original_composition'],
    basePrompt:
      'A clean e-commerce studio product photograph of the product on a seamless solid light background, soft even studio lighting, subtle natural shadow under the product, product centered and fully visible.',
    negativeConstraints: ['props or decor', 'gradient or textured background'],
    suggestedAspect: '1:1',
    defaultStyleId: 'clean_commercial',
    reference: { minImages: 1, preferred: 'full_product', note: 'Ảnh toàn bộ sản phẩm.' },
  },
  {
    id: 'lifestyle_home_ad',
    code: '10',
    name: 'Quảng cáo lifestyle gia đình',
    description: 'Ảnh quảng cáo trong không gian gia đình, bố cục hợp TikTok, chừa chỗ chèn chữ.',
    version: '1.0.0',
    groups: ['bedding', 'mat', 'rug', 'textile'],
    excludeKinds: [],
    recommendedKinds: ['doormat', 'other_textile'],
    generic: true,
    modes: ['product_ad', 'lifestyle_interior', 'batch_variations'],
    basePrompt:
      'A bright lifestyle advertising photograph of the product {placement} in a warm, tidy family home, aspirational but realistic, product as the clear hero of the image.',
    negativeConstraints: ['people covering the product'],
    suggestedAspect: '9:16',
    defaultStyleId: 'natural_daylight',
    reference: { minImages: 1, preferred: 'full_product', note: 'Ảnh toàn bộ sản phẩm.' },
  },
];

export function findImageTemplate(id: string): ImageTemplate | undefined {
  return IMAGE_TEMPLATES.find((t) => t.id === id);
}

/**
 * Cách đặt sản phẩm theo loại (tiếng Anh, cho model ảnh). Không nêu thuộc tính nào ngoài loại.
 */
export const PLACEMENT_BY_KIND: Record<HomeLivingKind, string> = {
  bedding_set: 'neatly made on the bed',
  blanket: 'spread or softly folded on the bed',
  bed_sheet: 'fitted neatly on the bed',
  pillowcase: 'on pillows arranged at the head of the bed',
  pillow: 'arranged at the head of the bed',
  sleeping_mat: 'laid flat on the bed or sleeping platform',
  living_room_rug: 'laid flat on the floor',
  bedroom_rug: 'laid flat on the bedroom floor beside the bed',
  bed_rug: 'laid flat across the bed',
  doormat: 'laid flat on the floor at the home entrance door',
  rug: 'laid flat on the floor',
  other_textile: 'placed naturally where it would be used',
};
export const PLACEMENT_UNKNOWN = 'placed naturally in the scene';

/** Kiểm tra template có dùng được cho sản phẩm + chế độ hay không, kèm lý do tiếng Việt. */
export function templateApplicability(
  template: ImageTemplate,
  ctx: Pick<ProductVisualContext, 'kind' | 'group'>,
  mode?: ImageMode,
): { applicable: boolean; reason: string | null } {
  if (mode && !template.modes.includes(mode)) {
    return { applicable: false, reason: 'Template không hỗ trợ chế độ tạo ảnh đã chọn' };
  }
  if (!ctx.group || !ctx.kind) {
    return template.generic
      ? { applicable: true, reason: null }
      : {
          applicable: false,
          reason: 'Chưa nhận diện được loại sản phẩm (tên/danh mục) – chỉ dùng được template chung',
        };
  }
  if (!template.groups.includes(ctx.group)) {
    return { applicable: false, reason: 'Template không dành cho nhóm sản phẩm này' };
  }
  if (template.excludeKinds.includes(ctx.kind)) {
    return { applicable: false, reason: 'Bối cảnh không phù hợp với loại sản phẩm này' };
  }
  return { applicable: true, reason: null };
}

/**
 * TEMPLATE SELECTOR: mọi template kèm trạng thái áp dụng/gợi ý, sắp xếp
 * gợi ý trước -> áp dụng được -> không áp dụng (giữ thứ tự code trong mỗi nhóm).
 */
export function matchTemplates(
  ctx: Pick<ProductVisualContext, 'kind' | 'group'>,
  mode?: ImageMode,
): ImageTemplateMatch[] {
  const matches = IMAGE_TEMPLATES.map((template) => {
    const { applicable, reason } = templateApplicability(template, ctx, mode);
    const recommended =
      applicable &&
      (ctx.kind
        ? template.recommendedKinds.includes(ctx.kind)
        : template.id === 'clean_studio' || template.id === 'lifestyle_home_ad');
    return { template, applicable, recommended, reason };
  });
  const rank = (m: ImageTemplateMatch) => (m.recommended ? 0 : m.applicable ? 1 : 2);
  return matches
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map(({ m }) => m);
}

/**
 * HƯỚNG BIẾN THỂ cho Mode E / tạo nhiều ảnh – mỗi ảnh một góc máy/ánh sáng khác nhau,
 * KHÔNG thay đổi sản phẩm. Biến thể 0 = theo template, không thêm hướng.
 */
export const IMAGE_VARIATIONS: readonly string[] = [
  '',
  'Variation: slightly elevated three-quarter camera angle, wider view of the room.',
  'Variation: eye-level camera, closer framing on the product, background softly blurred.',
  'Variation: soft morning light from the side, different but matching decor accents.',
  'Variation: late-afternoon warm light, alternative furniture arrangement in the same style.',
  'Variation: straight-on frontal composition, symmetric layout.',
];
