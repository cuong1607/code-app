import type { ScriptAngle, ScriptTemplate } from '@acs/shared';

/**
 * TEMPLATE KỊCH BẢN (phiên bản hoá). Đổi nội dung prompt => tăng `version` để kịch bản đã lưu
 * vẫn biết được tạo bằng phiên bản nào.
 */
export const SCRIPT_TEMPLATES: readonly ScriptTemplate[] = [
  {
    id: 'review',
    name: 'Review chân thực',
    description: 'Giới thiệu khách quan các đặc điểm có thật, nêu rõ phù hợp với ai.',
    version: '1.0.0',
    structure: ['HOOK', 'INTRO', 'FEATURE', 'FEATURE', 'BENEFIT', 'CTA'],
    rules: [
      'Giọng khách quan, mô tả đúng dữ kiện, không khen quá mức.',
      'Có thể nêu một lưu ý khi sử dụng nếu dữ kiện cho phép (vd hướng dẫn bảo quản).',
      'Không tự nhận đã dùng sản phẩm; dùng cách nói "sản phẩm có…", "điểm đáng chú ý là…".',
    ],
    promptTemplate:
      'Viết kịch bản review chân thực cho sản phẩm. Tập trung 2–3 đặc điểm có thật trong dữ liệu, giải thích lợi ích thực tế của từng đặc điểm, kết thúc bằng gợi ý ai nên chọn sản phẩm.',
    requires: [],
  },
  {
    id: 'ugc',
    name: 'UGC – góc nhìn người dùng',
    description: 'Phong cách quay tự nhiên như người dùng chia sẻ, nhưng không bịa trải nghiệm.',
    version: '1.0.0',
    structure: ['HOOK', 'PROBLEM', 'DEMO', 'BENEFIT', 'CTA'],
    rules: [
      'Phong cách đời thường, câu ngắn, như đang nói chuyện với bạn bè.',
      'KHÔNG nói "mình đã dùng X tuần", không bịa kết quả trải nghiệm hay cảm nhận cá nhân.',
      'Dùng góc nhìn gợi ý: "nếu bạn…", "thử hình dung…", "khi mở hộp sẽ thấy…" (chỉ điều có trong dữ liệu).',
    ],
    promptTemplate:
      'Viết kịch bản kiểu UGC: người dẫn nói chuyện tự nhiên trước camera điện thoại, trình diễn sản phẩm trong tình huống đời thường, nhấn mạnh đặc điểm có thật.',
    requires: [],
  },
  {
    id: 'storytelling',
    name: 'Storytelling – kể chuyện',
    description: 'Một câu chuyện ngắn có tình huống, nút thắt và cách sản phẩm góp mặt.',
    version: '1.0.0',
    structure: ['HOOK', 'STORY', 'PROBLEM', 'FEATURE', 'BENEFIT', 'CTA'],
    rules: [
      'Nhân vật là hư cấu và được kể ở ngôi thứ ba hoặc "bạn"; không giả làm khách hàng thật.',
      'Câu chuyện phải dẫn tự nhiên tới đặc điểm có thật của sản phẩm.',
    ],
    promptTemplate:
      'Viết kịch bản kể chuyện ngắn: mở bằng một khoảnh khắc đời thường, xây dựng một vấn đề nhỏ, sản phẩm xuất hiện như một lựa chọn hợp lý nhờ đặc điểm có thật.',
    requires: [],
  },
  {
    id: 'tiktok_sales',
    name: 'TikTok bán hàng',
    description: 'Nhịp nhanh, câu ngắn, mỗi cảnh một thông điệp, CTA rõ ràng.',
    version: '1.0.0',
    structure: ['HOOK', 'FEATURE', 'FEATURE', 'BENEFIT', 'CTA'],
    rules: [
      'Mỗi câu thoại tối đa khoảng 15 âm tiết, nhịp nhanh.',
      'Overlay text ngắn (2–5 từ) để người xem tắt tiếng vẫn hiểu.',
      'CTA rõ ràng nhưng không hứa hẹn khuyến mãi không có trong dữ liệu.',
    ],
    promptTemplate:
      'Viết kịch bản TikTok bán hàng nhịp nhanh: hook mạnh trong 3 giây đầu, mỗi cảnh một lý do để quan tâm, kết thúc bằng lời kêu gọi xem chi tiết sản phẩm.',
    requires: [],
  },
  {
    id: 'fashion',
    name: 'Giới thiệu thời trang',
    description: 'Tập trung chất liệu, form dáng, màu sắc và gợi ý phối đồ.',
    version: '1.0.0',
    structure: ['HOOK', 'INTRO', 'FEATURE', 'DEMO', 'BENEFIT', 'CTA'],
    rules: [
      'Chỉ nêu chất liệu/màu/size có trong dữ liệu; không tự thêm thông số.',
      'Gợi ý phối đồ là gợi ý phong cách, không khẳng định công dụng.',
      'Visual prompt ưu tiên cận cảnh chất liệu và toàn thân người mẫu.',
    ],
    promptTemplate:
      'Viết kịch bản giới thiệu sản phẩm thời trang: cận cảnh chất liệu, form dáng, các màu có sẵn, 1–2 gợi ý phối đồ phù hợp đối tượng.',
    requires: [],
  },
  {
    id: 'product_ad',
    name: 'Quảng cáo sản phẩm',
    description: 'Quảng cáo chỉn chu, hình ảnh đẹp, thông điệp thương hiệu rõ.',
    version: '1.0.0',
    structure: ['HOOK', 'INTRO', 'FEATURE', 'BENEFIT', 'CTA'],
    rules: [
      'Ngôn ngữ chuyên nghiệp, không dùng từ tuyệt đối ("tốt nhất", "số 1", "100%").',
      'Visual prompt mang phong cách quảng cáo studio, ánh sáng đẹp.',
    ],
    promptTemplate:
      'Viết kịch bản quảng cáo sản phẩm chuyên nghiệp: hình ảnh sang, thông điệp chính rõ ràng, nêu đặc điểm nổi bật có thật và lợi ích tương ứng.',
    requires: [],
  },
  {
    id: 'comparison',
    name: 'So sánh sản phẩm',
    description: 'So sánh khách quan giữa các sản phẩm trong cửa hàng – cần chọn sản phẩm thứ hai.',
    version: '1.0.0',
    structure: ['HOOK', 'INTRO', 'COMPARISON', 'COMPARISON', 'BENEFIT', 'CTA'],
    rules: [
      'CHỈ so sánh các dữ kiện có trong dữ liệu của cả hai sản phẩm.',
      'Không chê sản phẩm khác; trình bày "phù hợp với ai" thay vì "tốt hơn".',
      'Nếu một tiêu chí chỉ có dữ liệu ở một bên thì không so sánh tiêu chí đó.',
    ],
    promptTemplate:
      'Viết kịch bản so sánh khách quan giữa sản phẩm chính và sản phẩm so sánh, giúp người xem chọn được sản phẩm phù hợp nhu cầu.',
    requires: ['compareProducts'],
  },
  {
    id: 'custom',
    name: 'Theo yêu cầu tuỳ chỉnh',
    description: 'Bạn mô tả hướng kịch bản; quy tắc an toàn và dữ kiện vẫn được áp dụng.',
    version: '1.0.0',
    structure: ['HOOK', 'FEATURE', 'BENEFIT', 'CTA'],
    rules: ['Làm theo yêu cầu của người dùng nhưng KHÔNG vi phạm quy tắc hệ thống.'],
    promptTemplate:
      'Viết kịch bản theo yêu cầu tuỳ chỉnh của người dùng (xem <user_creative_request>), giữ đúng dữ kiện sản phẩm.',
    requires: ['customInstructions'],
  },
];

export function findTemplate(id: string): ScriptTemplate | undefined {
  return SCRIPT_TEMPLATES.find((t) => t.id === id);
}

/**
 * HƯỚNG TRIỂN KHAI cho từng biến thể – mỗi biến thể một góc khác nhau để nội dung
 * khác nhau thật sự (không chỉ đổi vài từ).
 */
export const SCRIPT_ANGLES: readonly ScriptAngle[] = [
  {
    id: 'natural',
    label: 'Giới thiệu tự nhiên',
    direction: 'giới thiệu tự nhiên, mạch lạc theo cấu trúc template',
  },
  {
    id: 'problem_solution',
    label: 'Vấn đề – giải pháp',
    direction: 'mở bằng một vấn đề cụ thể, sản phẩm là giải pháp dựa trên đặc điểm có thật',
  },
  { id: 'story', label: 'Kể chuyện', direction: 'dẫn dắt bằng một tình huống/câu chuyện ngắn' },
  {
    id: 'feature_focus',
    label: 'Đặc điểm nổi bật',
    direction: 'xoáy sâu vào MỘT đặc điểm nổi bật nhất trong dữ liệu',
  },
  {
    id: 'short_tiktok',
    label: 'Ngắn gọn kiểu TikTok',
    direction: 'cực ngắn gọn, ít cảnh, câu rất ngắn, nhịp nhanh',
  },
  {
    id: 'everyday',
    label: 'Ứng dụng hằng ngày',
    direction: 'đặt sản phẩm vào các khoảnh khắc sử dụng hằng ngày',
  },
  {
    id: 'detail',
    label: 'Cận cảnh chi tiết',
    direction:
      'dẫn người xem đi qua các chi tiết (chất liệu, hoàn thiện, kích thước) có trong dữ liệu',
  },
  {
    id: 'audience_fit',
    label: 'Phù hợp với ai',
    direction: 'trả lời câu hỏi sản phẩm này phù hợp với ai và vì sao',
  },
  {
    id: 'myth',
    label: 'Hỏi đáp nhanh',
    direction: 'dạng hỏi – đáp nhanh các thắc mắc thường gặp, chỉ trả lời bằng dữ kiện có thật',
  },
  {
    id: 'checklist',
    label: 'Checklist chọn mua',
    direction: 'dạng checklist các tiêu chí nên xem khi chọn loại sản phẩm này',
  },
];

/** Chọn N góc khác nhau; góc đầu tiên khớp template. */
export function pickAngles(count: number): ScriptAngle[] {
  return SCRIPT_ANGLES.slice(0, Math.min(count, SCRIPT_ANGLES.length));
}
