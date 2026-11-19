import { describe, expect, it } from 'vitest';
import {
  type ScriptDocument,
  buildNarration,
  normalizeScriptDocument,
  scriptDocumentSchema,
  scriptGenerateRequestSchema,
  upgradeScriptContent,
} from './script-engine';
import {
  countSpokenSyllables,
  estimateSpeechSeconds,
  lintScriptDocument,
  textSimilarity,
  validationStatusOf,
} from './script-quality';

export function sampleDoc(over: Partial<ScriptDocument> = {}): ScriptDocument {
  const scenes: ScriptDocument['scenes'] = [
    {
      index: 1,
      sceneType: 'HOOK',
      durationHintSeconds: 3,
      description: 'Mở đầu',
      visualPrompt: 'Close-up, vertical 9:16',
      spokenText: 'Bạn đang tìm một chiếc áo dễ phối đồ?',
      overlayText: 'Gợi ý hôm nay',
      visualSource: 'PRODUCT_IMAGE',
    },
    {
      index: 2,
      sceneType: 'FEATURE',
      durationHintSeconds: 12,
      description: 'Chất liệu',
      visualPrompt: 'Fabric detail, vertical 9:16',
      spokenText: 'Áo làm từ cotton, mặc thoáng và mềm khi vận động cả ngày.',
      overlayText: 'Cotton',
      visualSource: 'PRODUCT_IMAGE',
    },
    {
      index: 3,
      sceneType: 'CTA',
      durationHintSeconds: 5,
      description: 'Kêu gọi',
      visualPrompt: 'Product centered, vertical 9:16',
      spokenText: 'Xem thêm chi tiết sản phẩm ở phần mô tả nhé.',
      overlayText: 'Xem chi tiết',
      visualSource: 'PRODUCT_IMAGE',
    },
  ];
  return {
    schemaVersion: 2,
    language: 'vi-VN',
    title: 'Review áo thun',
    style: 'Review',
    targetDurationSeconds: 20,
    hook: 'Bạn đang tìm một chiếc áo dễ phối đồ?',
    narration: buildNarration(scenes),
    scenes,
    caption: 'Áo thun cotton dễ phối đồ.',
    hashtags: ['#aothun', '#review', '#thoitrang'],
    cta: 'Xem thêm chi tiết sản phẩm',
    complianceFlags: [],
    ...over,
  };
}

const AI = { mode: 'ai' as const, includePrice: false };

describe('ScriptDocument schema', () => {
  it('chấp nhận tài liệu hợp lệ, từ chối trường lạ', () => {
    expect(scriptDocumentSchema.safeParse(sampleDoc()).success).toBe(true);
    expect(scriptDocumentSchema.safeParse({ ...sampleDoc(), extra: 1 }).success).toBe(false);
  });

  it('lời thoại cảnh rỗng, hashtag có dấu cách -> lỗi', () => {
    const d = sampleDoc();
    expect(
      scriptDocumentSchema.safeParse({ ...d, scenes: [{ ...d.scenes[0]!, spokenText: '  ' }] })
        .success,
    ).toBe(false);
    expect(scriptDocumentSchema.safeParse({ ...d, hashtags: ['#ao thun'] }).success).toBe(false);
  });

  it('normalize đánh lại index và ghép narration từ lời thoại cảnh', () => {
    const d = sampleDoc();
    const n = normalizeScriptDocument({
      ...d,
      narration: 'sai',
      scenes: [d.scenes[0]!, { ...d.scenes[2]!, index: 9 }],
    });
    expect(n.scenes.map((s) => s.index)).toEqual([1, 2]);
    expect(n.narration).toBe(`${d.scenes[0]!.spokenText} ${d.scenes[2]!.spokenText}`);
  });
});

describe('Tương thích bản nháp Phase 02 (v1)', () => {
  const v1 = {
    title: 'Kịch bản cũ',
    hook: 'Hook cũ',
    voiceover: 'Lời thoại cũ',
    scenes: [
      { order: 2, durationSeconds: 5, voiceover: 'Cảnh hai', visualPrompt: 'B' },
      {
        order: 1,
        durationSeconds: 3,
        voiceover: 'Cảnh một',
        visualPrompt: 'A',
        onScreenText: 'Chữ',
      },
    ],
    caption: 'Caption cũ',
    hashtags: ['#cu', 'khong co thang'],
    cta: 'Mua ngay',
  };

  it('nâng cấp v1 -> v2 không mất nội dung', () => {
    const up = upgradeScriptContent(v1, { targetDurationSeconds: 30 })!;
    expect(up.legacy).toBe(true);
    expect(scriptDocumentSchema.safeParse(up.document).success).toBe(true);
    expect(up.document.scenes.map((s) => s.spokenText)).toEqual(['Cảnh một', 'Cảnh hai']);
    expect(up.document.scenes[0]!.overlayText).toBe('Chữ');
    expect(up.document.hashtags).toEqual(['#cu', '#khongcothang']);
    expect(up.document.targetDurationSeconds).toBe(30);
  });

  it('v2 giữ nguyên; dữ liệu lạ -> null', () => {
    expect(upgradeScriptContent(sampleDoc())!.legacy).toBe(false);
    expect(upgradeScriptContent({ foo: 1 })).toBeNull();
  });
});

describe('Ước tính thời lượng đọc (dự kiến)', () => {
  it('đếm âm tiết tiếng Việt và số', () => {
    expect(countSpokenSyllables('Xin chào cả nhà')).toBe(4);
    expect(countSpokenSyllables('Giá 199.000')).toBeGreaterThanOrEqual(1 + 6);
  });

  it('tốc độ nhanh hơn -> thời lượng ngắn hơn', () => {
    const t = 'Áo làm từ cotton, mặc thoáng và mềm khi vận động cả ngày.';
    expect(estimateSpeechSeconds(t, 1.2)).toBeLessThan(estimateSpeechSeconds(t, 1));
    expect(estimateSpeechSeconds('')).toBe(0);
  });
});

describe('Kiểm tra chất lượng kịch bản', () => {
  it('kịch bản tốt -> không có lỗi', () => {
    const issues = lintScriptDocument(sampleDoc(), AI);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('hashtag/emoji/URL trong lời thoại là lỗi (TTS)', () => {
    const d = sampleDoc();
    const bad = {
      ...d,
      scenes: d.scenes.map((s, i) =>
        i === 1 ? { ...s, spokenText: 'Mua tại www.shop.vn nhé #sale 😍 cực kỳ dễ thương' } : s,
      ),
    };
    const codes = lintScriptDocument(bad, AI).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['SPOKEN_HASHTAG', 'SPOKEN_URL', 'SPOKEN_EMOJI']));
  });

  it('bịa giá / khuyến mãi khi chưa cho phép -> lỗi', () => {
    const codes = lintScriptDocument(
      sampleDoc({ caption: 'Chỉ còn 99k, freeship toàn quốc' }),
      AI,
    ).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['PRICE_NOT_ALLOWED', 'PROMO_NOT_ALLOWED']));
  });

  it('giá đúng khi cho phép -> không lỗi; giá sai -> PRICE_MISMATCH', () => {
    const opts = { mode: 'ai' as const, includePrice: true, sellingPriceDigits: '199000' };
    expect(
      lintScriptDocument(sampleDoc({ caption: 'Giá 199.000đ' }), opts).filter((i) =>
        i.code.startsWith('PRICE'),
      ),
    ).toEqual([]);
    expect(
      lintScriptDocument(sampleDoc({ caption: 'Giá 150.000đ' }), opts).map((i) => i.code),
    ).toContain('PRICE_MISMATCH');
  });

  it('cảnh đầu không phải HOOK, tổng thời lượng lệch -> lỗi; sửa tay chỉ là cảnh báo', () => {
    const d = sampleDoc({ targetDurationSeconds: 60 });
    const bad = {
      ...d,
      scenes: [
        { ...d.scenes[1]!, index: 1 },
        { ...d.scenes[2]!, index: 2 },
      ],
    };
    const ai = lintScriptDocument(bad, AI).map((i) => i.code);
    expect(ai).toEqual(expect.arrayContaining(['HOOK_FIRST', 'DURATION_MISMATCH']));
    expect(validationStatusOf(lintScriptDocument(bad, { ...AI, mode: 'manual' }))).toBe('warnings');
  });

  it('cảnh báo tự nhận trải nghiệm / chứng thực / tuyên bố tuyệt đối', () => {
    const codes = lintScriptDocument(
      sampleDoc({ caption: 'Mình đã dùng 3 tháng, tốt nhất thị trường, ai dùng cũng khen' }),
      AI,
    ).map((i) => i.code);
    expect(codes).toEqual(
      expect.arrayContaining(['FIRST_PERSON_EXPERIENCE', 'EXAGGERATED_CLAIM', 'FAKE_TESTIMONIAL']),
    );
  });

  it('độ giống nhau giữa hook', () => {
    expect(textSimilarity('Bạn đã thử chưa?', 'bạn đã thử chưa')).toBe(1);
    expect(textSimilarity('Áo cotton mát', 'Giày chạy bộ nhẹ')).toBe(0);
  });
});

describe('Yêu cầu tạo kịch bản', () => {
  const base = {
    productId: '00000000-0000-4000-8000-000000000099',
    templateId: 'review',
    durationSeconds: 30,
    audienceId: 'general',
    toneId: 'friendly',
    hookStyleId: 'question',
    ctaStyleId: 'soft',
    variantCount: 3,
  };
  it('mặc định tiếng Việt, không đưa giá', () => {
    const r = scriptGenerateRequestSchema.parse(base);
    expect(r.language).toBe('vi-VN');
    expect(r.includePrice).toBe(false);
  });
  it('từ chối thời lượng/số phiên bản ngoài danh sách và trường lạ (vd workspaceId)', () => {
    expect(scriptGenerateRequestSchema.safeParse({ ...base, durationSeconds: 25 }).success).toBe(
      false,
    );
    expect(scriptGenerateRequestSchema.safeParse({ ...base, variantCount: 4 }).success).toBe(false);
    expect(
      scriptGenerateRequestSchema.safeParse({ ...base, workspaceId: base.productId }).success,
    ).toBe(false);
  });
});
