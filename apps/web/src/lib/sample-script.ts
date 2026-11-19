import type { ScriptContent } from '@acs/shared';

/**
 * KHUÔN KỊCH BẢN MẪU (cố định, KHÔNG do AI tạo) để người dùng có điểm bắt đầu và chỉnh sửa tay.
 * AI viết kịch bản thật sẽ có ở Phase 03.
 */
export function buildSampleScript(productName: string, durationSec: number): ScriptContent {
  const scene = Math.max(3, Math.round(durationSec / 4));
  const lower = productName.toLowerCase();
  return {
    title: `${productName} – bí quyết khiến ai cũng hỏi mua ở đâu`,
    hook: `Bạn đã thử ${lower} này chưa? 3 giây nữa bạn sẽ hiểu vì sao nó cháy hàng!`,
    voiceover: `Xin chào cả nhà! Hôm nay mình giới thiệu ${lower} – sản phẩm mình dùng mỗi ngày. Thiết kế tinh tế, chất lượng ổn định và giá cực kỳ dễ chịu. Bấm giỏ hàng ngay để nhận ưu đãi hôm nay nhé!`,
    scenes: [
      {
        order: 1,
        durationSeconds: scene,
        voiceover: `Bạn đã thử ${lower} này chưa?`,
        visualPrompt: `Cận cảnh ${productName}, ánh sáng tự nhiên, máy quay tiến chậm vào sản phẩm`,
        onScreenText: 'Đừng lướt qua!',
      },
      {
        order: 2,
        durationSeconds: scene,
        voiceover: 'Thiết kế tinh tế, hoàn thiện tỉ mỉ đến từng chi tiết.',
        visualPrompt: `Xoay 360 độ quanh ${productName} trên nền be, bóng đổ mềm`,
        onScreenText: 'Thiết kế tinh tế',
      },
      {
        order: 3,
        durationSeconds: scene,
        voiceover: 'Dùng hằng ngày cực kỳ tiện lợi, ai dùng cũng khen.',
        visualPrompt: `Người dùng trải nghiệm ${productName} trong bối cảnh đời thường`,
        onScreenText: 'Tiện lợi mỗi ngày',
      },
      {
        order: 4,
        durationSeconds: Math.max(1, durationSec - scene * 3),
        voiceover: 'Bấm giỏ hàng ngay để nhận ưu đãi hôm nay!',
        visualPrompt: `${productName} chính giữa khung hình, hiệu ứng chữ giá ưu đãi`,
        onScreenText: 'Ưu đãi hôm nay',
      },
    ],
    caption: `${productName} – chất lượng thật, giá hợp lý. Mua ngay hôm nay!`,
    hashtags: ['#xuhuong', '#review', '#muasamonline', '#fyp'],
    cta: 'Bấm vào giỏ hàng góc trái để đặt ngay!',
  };
}
