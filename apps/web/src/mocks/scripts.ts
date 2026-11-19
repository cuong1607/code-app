/** DỮ LIỆU DEMO – kịch bản mẫu. KHÔNG phải kết quả AI thật. */
import type { GeneratedScript } from '@/types/domain';

export function buildDemoScript(productName: string, durationSec: number): GeneratedScript {
  const sceneDuration = Math.max(3, Math.round(durationSec / 4));
  return {
    id: `demo-script-${productName.length}-${durationSec}`,
    title: `${productName} – bí quyết khiến ai cũng hỏi mua ở đâu`,
    hook: `Bạn đã thử ${productName.toLowerCase()} này chưa? 3 giây nữa bạn sẽ hiểu vì sao nó cháy hàng!`,
    voiceover: `Xin chào cả nhà! Hôm nay mình giới thiệu ${productName.toLowerCase()} – sản phẩm mình dùng mỗi ngày. Thiết kế tinh tế, chất lượng ổn định và giá cực kỳ dễ chịu. Bấm giỏ hàng ngay để nhận ưu đãi hôm nay nhé!`,
    scenes: [
      {
        order: 1,
        durationSeconds: sceneDuration,
        voiceover: `Bạn đã thử ${productName.toLowerCase()} này chưa?`,
        visualPrompt: `Cận cảnh ${productName}, ánh sáng tự nhiên, máy quay tiến chậm vào sản phẩm`,
        onScreenText: 'Đừng lướt qua!',
      },
      {
        order: 2,
        durationSeconds: sceneDuration,
        voiceover: 'Thiết kế tinh tế, hoàn thiện tỉ mỉ đến từng chi tiết.',
        visualPrompt: `Xoay 360 độ quanh ${productName} trên nền be, bóng đổ mềm`,
        onScreenText: 'Thiết kế tinh tế',
      },
      {
        order: 3,
        durationSeconds: sceneDuration,
        voiceover: 'Dùng hằng ngày cực kỳ tiện lợi, ai dùng cũng khen.',
        visualPrompt: `Người dùng trải nghiệm ${productName} trong bối cảnh đời thường`,
        onScreenText: 'Tiện lợi mỗi ngày',
      },
      {
        order: 4,
        durationSeconds: durationSec - sceneDuration * 3,
        voiceover: 'Bấm giỏ hàng ngay để nhận ưu đãi hôm nay!',
        visualPrompt: `${productName} chính giữa khung hình, hiệu ứng chữ giá ưu đãi`,
        onScreenText: 'Ưu đãi hôm nay',
      },
    ],
    caption: `${productName} – chất lượng thật, giá hợp lý. Mua ngay hôm nay! (caption DEMO)`,
    hashtags: ['#xuhuong', '#review', '#muasamonline', '#fyp'],
    cta: 'Bấm vào giỏ hàng góc trái để đặt ngay!',
    isDemo: true,
  };
}
