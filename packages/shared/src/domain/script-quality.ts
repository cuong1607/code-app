import type { ScriptDocument, ScriptIssue } from './script-engine';

/**
 * ƯỚC TÍNH THỜI LƯỢNG ĐỌC (tiếng Việt).
 * Tiếng Việt đơn âm tiết: mỗi từ cách nhau bởi khoảng trắng ≈ 1 âm tiết.
 * Tốc độ trung bình video bán hàng ≈ 3,2 âm tiết/giây (~190 âm tiết/phút) ở tốc độ 1x.
 * KẾT QUẢ LÀ DỰ KIẾN – thời lượng audio thực tế chỉ có sau khi tạo TTS (Phase 05).
 */
export const SPEECH_SYLLABLES_PER_SECOND = 3.2;

export function countSpokenSyllables(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) {
    if (!token) continue;
    const digits = token.replace(/\D/g, '');
    if (digits.length > 0 && !/\p{L}/u.test(token)) {
      // Số được đọc thành nhiều âm tiết ("199.000" ≈ "một trăm chín mươi chín nghìn")
      count += Math.max(2, Math.ceil(digits.length * 1.5));
    } else if (/[\p{L}\p{N}]/u.test(token)) {
      count += 1;
    }
  }
  return count;
}

export function estimateSpeechSeconds(text: string, speed = 1): number {
  const syllables = countSpokenSyllables(text);
  if (!syllables) return 0;
  const strongPauses = (text.match(/[.!?…]+/g) ?? []).length;
  const softPauses = (text.match(/[,;:–-]/g) ?? []).length;
  const seconds =
    syllables / (SPEECH_SYLLABLES_PER_SECOND * Math.max(0.5, Math.min(2, speed))) +
    strongPauses * 0.35 +
    softPauses * 0.15;
  return Math.round(seconds * 10) / 10;
}

// ------------------------------------------------------------------ Phát hiện nội dung rủi ro
const MONEY_RE =
  /(?:(?:giá|chỉ còn|chỉ từ)\s*(?:chỉ\s*)?)?\d[\d.,]*\s*(?:vnđ|vnd|đồng|đ|₫|k|nghìn|ngàn|triệu|tr|usd|\$)(?![\p{L}\p{N}])|(?:giá|chỉ còn|chỉ từ)\s*(?:chỉ\s*)?\d[\d.,]*/giu;
const PROMO_RE =
  /(giảm giá|giảm\s*\d+|khuyến mãi|khuyến mại|flash ?sale|\bsale\b|freeship|free ship|miễn phí vận chuyển|mã giảm|voucher|ưu đãi|quà tặng|tặng kèm|mua \d+ tặng)/iu;
const CLAIM_RE =
  /(tốt nhất|số 1\b|số một|100\s*%|cam kết|đảm bảo hiệu quả|thần kỳ|tuyệt đối|vĩnh viễn|hiệu quả ngay|điều trị|chữa khỏi|khỏi hẳn|trị dứt điểm)/iu;
const FIRST_PERSON_RE =
  /(mình đã (dùng|thử|mặc|xài)|tôi đã (dùng|thử|mặc|xài)|em đã (dùng|thử|mặc)|sau \d+ (ngày|tuần|tháng) (dùng|sử dụng)|mình dùng được)/iu;
const TESTIMONIAL_RE =
  /(khách hàng (đều )?khen|hàng (nghìn|ngàn|triệu) (người|khách)|ai dùng cũng khen|đánh giá 5 sao|review 5 sao|được (rất )?nhiều người tin dùng)/iu;
const URL_RE = /(https?:\/\/|www\.|\.(com|vn|net)\b)/iu;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const HARD_SYMBOL_RE = /[%&@*/+=<>{}[\]|\\^~_]/u;
const VI_DIACRITIC_RE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/iu;

export interface ScriptLintOptions {
  /** Kịch bản do AI tạo: lỗi chất lượng là "error" (kích hoạt sửa tự động). Sửa tay: hạ xuống "warning". */
  mode: 'ai' | 'manual';
  /** Người dùng cho phép nhắc giá bán */
  includePrice: boolean;
  /** Giá bán thật (chỉ số, vd "199000") – để đối chiếu khi includePrice */
  sellingPriceDigits?: string | null;
  speechSpeed?: number;
}

const normDigits = (s: string) => s.replace(/\D/g, '');

/** Kiểm tra chất lượng + tuân thủ. Không thay thế kiểm tra cấu trúc (Zod). */
export function lintScriptDocument(doc: ScriptDocument, opts: ScriptLintOptions): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const hard = opts.mode === 'ai' ? 'error' : 'warning';
  const add = (severity: ScriptIssue['severity'], code: string, path: string, message: string) =>
    issues.push({ severity, code, path, message });

  // ---- Cấu trúc cảnh
  doc.scenes.forEach((s, i) => {
    if (s.index !== i + 1)
      add(hard, 'SCENE_ORDER', `scenes.${i}.index`, `Cảnh thứ ${i + 1} phải có index = ${i + 1}`);
  });
  const first = doc.scenes[0];
  if (first && first.sceneType !== 'HOOK')
    add(hard, 'HOOK_FIRST', 'scenes.0.sceneType', 'Cảnh đầu tiên phải là HOOK');
  if (first && first.durationHintSeconds > 5)
    add(hard, 'HOOK_TOO_LONG', 'scenes.0.durationHintSeconds', 'Cảnh hook nên dài tối đa 5 giây');
  if (!doc.hook.trim()) add(hard, 'HOOK_EMPTY', 'hook', 'Thiếu hook mở đầu');
  const last = doc.scenes.at(-1);
  if (doc.scenes.length > 1 && last && last.sceneType !== 'CTA')
    add('warning', 'CTA_LAST', `scenes.${doc.scenes.length - 1}.sceneType`, 'Cảnh cuối nên là CTA');

  const total = doc.scenes.reduce((s, x) => s + x.durationHintSeconds, 0);
  const target = doc.targetDurationSeconds;
  if (total < target * 0.75 || total > target * 1.25)
    add(
      hard,
      'DURATION_MISMATCH',
      'scenes',
      `Tổng thời lượng cảnh ${Math.round(total)} giây lệch quá 25% so với mục tiêu ${target} giây`,
    );

  // ---- Lời thoại (tối ưu TTS)
  doc.scenes.forEach((s, i) => {
    const p = `scenes.${i}.spokenText`;
    if (s.spokenText.includes('#'))
      add(hard, 'SPOKEN_HASHTAG', p, `Cảnh ${i + 1}: lời thoại chứa hashtag`);
    if (URL_RE.test(s.spokenText))
      add(hard, 'SPOKEN_URL', p, `Cảnh ${i + 1}: lời thoại chứa đường dẫn`);
    if (EMOJI_RE.test(s.spokenText))
      add(hard, 'SPOKEN_EMOJI', p, `Cảnh ${i + 1}: lời thoại chứa emoji`);
    if (HARD_SYMBOL_RE.test(s.spokenText))
      add('warning', 'SPOKEN_SYMBOL', p, `Cảnh ${i + 1}: lời thoại có ký hiệu khó đọc`);
    if (s.spokenText.length > 20 && !VI_DIACRITIC_RE.test(s.spokenText))
      add(hard, 'SPOKEN_NO_DIACRITICS', p, `Cảnh ${i + 1}: lời thoại không có dấu tiếng Việt`);
    for (const sentence of s.spokenText.split(/[.!?…]+/)) {
      if (sentence.trim().split(/\s+/).length > 35) {
        add('warning', 'SPOKEN_LONG_SENTENCE', p, `Cảnh ${i + 1}: có câu quá dài (> 35 âm tiết)`);
        break;
      }
    }
    const est = estimateSpeechSeconds(s.spokenText, opts.speechSpeed);
    if (est > s.durationHintSeconds * 1.4 + 0.5)
      add(
        'warning',
        'SPOKEN_TOO_LONG_FOR_SCENE',
        p,
        `Cảnh ${i + 1}: đọc dự kiến ${est} giây, dài hơn thời lượng cảnh ${s.durationHintSeconds} giây`,
      );
  });

  // ---- Caption / hashtag / CTA
  if (!doc.caption.trim()) add(hard, 'CAPTION_EMPTY', 'caption', 'Thiếu caption');
  if (!doc.cta.trim()) add(hard, 'CTA_EMPTY', 'cta', 'Thiếu CTA');
  if (doc.hashtags.length < 3 || doc.hashtags.length > 10)
    add(hard, 'HASHTAG_COUNT', 'hashtags', 'Cần từ 3 đến 10 hashtag');
  const lower = doc.hashtags.map((h) => h.toLowerCase());
  if (new Set(lower).size !== lower.length)
    add(hard, 'HASHTAG_DUPLICATE', 'hashtags', 'Hashtag bị trùng lặp');

  // ---- Dữ kiện: giá & khuyến mãi (không được bịa)
  const fields: [string, string][] = [
    ['title', doc.title],
    ['hook', doc.hook],
    ['caption', doc.caption],
    ['cta', doc.cta],
    ...doc.scenes.flatMap((s, i): [string, string][] => [
      [`scenes.${i}.spokenText`, s.spokenText],
      [`scenes.${i}.overlayText`, s.overlayText],
    ]),
  ];
  const price = opts.sellingPriceDigits ? normDigits(opts.sellingPriceDigits) : '';
  for (const [path, text] of fields) {
    const money = [...text.matchAll(MONEY_RE)].map((m) => m[0]);
    if (money.length) {
      if (!opts.includePrice) {
        add(
          hard,
          'PRICE_NOT_ALLOWED',
          path,
          'Không được nhắc giá khi chưa cho phép đưa giá vào kịch bản',
        );
      } else {
        for (const m of money) {
          const d = normDigits(m);
          // "199k" -> 199 ; giá 199000 -> chấp nhận nếu khớp phần đầu (k = nghìn)
          const ok = !d || (price && (price === d || price === `${d}000` || price.startsWith(d)));
          if (!ok)
            add(
              hard,
              'PRICE_MISMATCH',
              path,
              `Giá "${m}" không khớp giá bán trong dữ liệu sản phẩm`,
            );
        }
      }
    }
    if (PROMO_RE.test(text))
      add(
        hard,
        'PROMO_NOT_ALLOWED',
        path,
        'Không được tự tạo khuyến mãi/ưu đãi (dữ liệu sản phẩm không có)',
      );
    if (CLAIM_RE.test(text))
      add('warning', 'EXAGGERATED_CLAIM', path, 'Có thể là tuyên bố quá mức / cam kết hiệu quả');
    if (FIRST_PERSON_RE.test(text))
      add(
        'warning',
        'FIRST_PERSON_EXPERIENCE',
        path,
        'Có thể đang tự nhận đã trải nghiệm sản phẩm',
      );
    if (TESTIMONIAL_RE.test(text))
      add('warning', 'FAKE_TESTIMONIAL', path, 'Có thể là lời chứng thực/khen ngợi không có nguồn');
  }
  return issues;
}

export const hasErrors = (issues: ScriptIssue[]) => issues.some((i) => i.severity === 'error');

export function validationStatusOf(issues: ScriptIssue[]): 'valid' | 'warnings' | 'invalid' {
  if (hasErrors(issues)) return 'invalid';
  return issues.length ? 'warnings' : 'valid';
}

/** Độ giống nhau giữa 2 câu (Jaccard theo âm tiết, đã bỏ dấu câu) – phát hiện biến thể na ná nhau. */
export function textSimilarity(a: string, b: string): number {
  const tok = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(Boolean),
    );
  const A = tok(a);
  const B = tok(b);
  if (!A.size && !B.size) return 1;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  return inter / (A.size + B.size - inter);
}
