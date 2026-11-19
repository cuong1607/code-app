import { type ScriptDocument, buildNarration } from '@acs/shared';

/**
 * KHUÔN KỊCH BẢN MẪU (cố định, KHÔNG do AI tạo) để soạn tay.
 * Được lưu với origin = "sample" và hiển thị nhãn "TỪ KHUÔN MẪU – KHÔNG PHẢI AI".
 * Không chứa giá/khuyến mãi để không tạo dữ kiện sai.
 */
export function buildSampleScript(productName: string, durationSec: number): ScriptDocument {
  const middle = Math.max(2, Math.round(((durationSec - 7) / 3) * 10) / 10);
  const scenes: ScriptDocument['scenes'] = [
    {
      index: 1,
      sceneType: 'HOOK',
      durationHintSeconds: 3,
      description: 'Mở đầu gây chú ý',
      visualPrompt: `Close-up of ${productName}, soft natural light, slow push-in, vertical 9:16`,
      spokenText: `Bạn đã biết đến ${productName} chưa?`,
      overlayText: 'Đừng lướt qua',
      visualSource: 'PRODUCT_IMAGE',
    },
    {
      index: 2,
      sceneType: 'FEATURE',
      durationHintSeconds: middle,
      description: 'Đặc điểm thứ nhất',
      visualPrompt: `360 degree view of ${productName} on beige background, vertical 9:16`,
      spokenText: 'Hãy thay câu này bằng một đặc điểm có thật của sản phẩm.',
      overlayText: 'Đặc điểm 1',
      visualSource: 'PRODUCT_IMAGE',
    },
    {
      index: 3,
      sceneType: 'BENEFIT',
      durationHintSeconds: middle,
      description: 'Lợi ích khi dùng',
      visualPrompt: `${productName} in an everyday scene, vertical 9:16`,
      spokenText: 'Nêu lợi ích thực tế đến từ đặc điểm trên.',
      overlayText: 'Lợi ích',
      visualSource: 'PRODUCT_IMAGE',
    },
    {
      index: 4,
      sceneType: 'CTA',
      durationHintSeconds: Math.max(2, durationSec - 3 - middle * 2),
      description: 'Kêu gọi hành động',
      visualPrompt: `${productName} centered, clean background, vertical 9:16`,
      spokenText: 'Xem thêm chi tiết sản phẩm ở phần mô tả nhé.',
      overlayText: 'Xem chi tiết',
      visualSource: 'PRODUCT_IMAGE',
    },
  ];
  return {
    schemaVersion: 2,
    language: 'vi-VN',
    title: `${productName} – kịch bản soạn tay`,
    style: 'Khuôn mẫu',
    targetDurationSeconds: durationSec,
    hook: scenes[0]!.spokenText,
    narration: buildNarration(scenes),
    scenes,
    caption: `Giới thiệu ${productName}.`,
    hashtags: ['#review', '#sanpham', '#muasamonline'],
    cta: 'Xem chi tiết sản phẩm',
    complianceFlags: [],
  };
}
