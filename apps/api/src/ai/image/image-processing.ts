import sharp from 'sharp';
import { AppError, type ImageAspect, type ImageAutoCheck } from '@acs/shared';
import { sniffImageMime } from '../../media/image-inspector';

/**
 * XỬ LÝ ẢNH TRUYỀN THỐNG (sharp) – không phải AI.
 *  - Chuẩn hoá ảnh tham chiếu trước khi gửi provider (xoay theo EXIF, thu nhỏ, bỏ metadata).
 *  - Đưa ảnh đầu ra về đúng tỷ lệ bằng PAD (thêm viền) – KHÔNG kéo giãn, KHÔNG cắt mất sản phẩm.
 *  - So sánh bảng màu ảnh gốc / ảnh AI: chỉ số THAM KHẢO, không bảo đảm giữ đúng sản phẩm.
 *  - Mode F: đặt nguyên ảnh gốc lên nền trơn.
 */
export const ASPECT_RATIO: Record<ImageAspect, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
};

/** Khung chuẩn cho ảnh ghép (Mode F) và ảnh Mock. */
export const CANVAS_SIZE: Record<ImageAspect, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};

/** Sai lệch tỷ lệ chấp nhận được (vd Gemini 9:16 = 768x1376 lệch ~0,8%). */
export const ASPECT_TOLERANCE = 0.015;
export const MAX_REFERENCE_SIDE = 2048;
/** Ảnh đầu ra tối đa (chống ảnh quá lớn từ provider) */
export const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;
const MAX_INPUT_PIXELS = 80_000_000;

const sh = (buf: Buffer) => sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });

/** Ảnh tham chiếu -> JPEG (hoặc PNG nếu có trong suốt), ≤ 2048px, bỏ EXIF. */
export async function normalizeReference(
  buf: Buffer,
): Promise<{ data: Buffer; mimeType: 'image/jpeg' | 'image/png' }> {
  try {
    const meta = await sh(buf).metadata();
    const pipeline = sh(buf).rotate().resize({
      width: MAX_REFERENCE_SIDE,
      height: MAX_REFERENCE_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    });
    if (meta.hasAlpha) {
      return { data: await pipeline.png().toBuffer(), mimeType: 'image/png' };
    }
    return { data: await pipeline.jpeg({ quality: 92 }).toBuffer(), mimeType: 'image/jpeg' };
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Ảnh tham chiếu bị hỏng hoặc không đọc được');
  }
}

export interface InspectedOutput {
  width: number;
  height: number;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
}

/** Kiểm tra ảnh provider trả về từ NỘI DUNG (magic bytes + giải mã được). */
export async function inspectOutput(buf: Buffer): Promise<InspectedOutput> {
  if (buf.length === 0 || buf.length > MAX_OUTPUT_BYTES) {
    throw new AppError('PROVIDER_ERROR', 'Ảnh trả về rỗng hoặc quá lớn', {
      reason: 'invalid_output',
    });
  }
  const mimeType = sniffImageMime(buf);
  if (!mimeType) {
    throw new AppError('PROVIDER_ERROR', 'Provider trả về dữ liệu không phải ảnh hợp lệ', {
      reason: 'invalid_output',
    });
  }
  try {
    const meta = await sh(buf).metadata();
    if (!meta.width || !meta.height) throw new Error('no size');
    return { width: meta.width, height: meta.height, mimeType };
  } catch {
    throw new AppError('PROVIDER_ERROR', 'Không giải mã được ảnh provider trả về', {
      reason: 'invalid_output',
    });
  }
}

function hex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Màu trung bình viền ảnh (dùng làm màu pad để viền thêm vào hài hoà). */
async function edgeColor(buf: Buffer): Promise<{ r: number; g: number; b: number }> {
  const { data, info } = await sh(buf)
    .removeAlpha()
    .resize(32, 32, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (x > 1 && y > 1 && x < info.width - 2 && y < info.height - 2) continue;
      const i = (y * info.width + x) * 3;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n += 1;
    }
  }
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Đưa ảnh về đúng tỷ lệ. Lệch ≤ ASPECT_TOLERANCE -> giữ nguyên.
 * Lệch hơn -> PAD đều 2 bên bằng màu viền (công khai trong autoCheck.fit), không kéo méo/cắt sản phẩm.
 */
export async function fitToAspect(
  buf: Buffer,
  aspect: ImageAspect,
): Promise<{ data: Buffer; mimeType: string; fit: ImageAutoCheck['fit'] }> {
  const meta = await inspectOutput(buf);
  const target = ASPECT_RATIO[aspect];
  const ratio = meta.width / meta.height;
  if (Math.abs(ratio - target) / target <= ASPECT_TOLERANCE) {
    return {
      data: buf,
      mimeType: meta.mimeType,
      fit: {
        mode: 'none',
        providerWidth: meta.width,
        providerHeight: meta.height,
        finalWidth: meta.width,
        finalHeight: meta.height,
      },
    };
  }
  let width = meta.width;
  let height = meta.height;
  if (ratio > target) height = Math.round(meta.width / target);
  else width = Math.round(meta.height * target);
  const padX = width - meta.width;
  const padY = height - meta.height;
  const background = await edgeColor(buf);
  const data = await sh(buf)
    .extend({
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      background: { ...background, alpha: 1 },
    })
    .png()
    .toBuffer();
  return {
    data,
    mimeType: 'image/png',
    fit: {
      mode: 'pad',
      providerWidth: meta.width,
      providerHeight: meta.height,
      finalWidth: width,
      finalHeight: height,
    },
  };
}

// ------------------------------------------------------------------ So sánh màu (tham khảo)
interface Bucket {
  r: number;
  g: number;
  b: number;
  count: number;
}

async function rawPixels(buf: Buffer, side: number) {
  return sh(buf)
    .removeAlpha()
    .resize(side, side, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
}

/** Lượng tử hoá 4 bit/kênh -> các nhóm màu, sắp theo số điểm ảnh giảm dần. */
function buckets(data: Buffer, filter?: (x: number, y: number) => boolean, width = 0): Bucket[] {
  const map = new Map<number, Bucket>();
  for (let i = 0, p = 0; i < data.length; i += 3, p += 1) {
    if (filter && !filter(p % width, Math.floor(p / width))) continue;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = map.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    cur.r += r;
    cur.g += g;
    cur.b += b;
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()]
    .map((c) => ({ r: c.r / c.count, g: c.g / c.count, b: c.b / c.count, count: c.count }))
    .sort((a, b) => b.count - a.count);
}

function toLab(c: { r: number; g: number; b: number }): [number, number, number] {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = lin(c.r);
  const g = lin(c.g);
  const b = lin(c.b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
) {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

export const COLOR_MATCH_DELTA_E = 18;
export const COLOR_COVERAGE_WARN = 0.6;
export const COLOR_CHECK_METHOD =
  'So khớp màu chủ đạo (ΔE CIE76 ≤ 18) của ảnh gốc – đã loại màu nền viền ảnh gốc – với toàn bộ ảnh mới. Chỉ là chỉ số tham khảo, không xác định được sản phẩm nằm ở đâu trong ảnh.';

/**
 * Tỷ lệ (theo trọng số) màu chủ đạo của ẢNH GỐC xuất hiện trong ẢNH MỚI.
 * Loại các màu trùng màu viền ảnh gốc (thường là phông nền chụp sản phẩm).
 */
export async function compareColors(
  reference: Buffer,
  output: Buffer,
): Promise<{ coverage: number | null; referencePalette: string[]; outputPalette: string[] }> {
  const side = 48;
  const ref = await rawPixels(reference, side);
  const border = (x: number, y: number) => x < 4 || y < 4 || x >= side - 4 || y >= side - 4;
  const borderTop = buckets(ref.data, border, side)[0];
  const refAll = buckets(ref.data);
  const total = refAll.reduce((s, c) => s + c.count, 0);
  const refMain = refAll
    .filter((c) => c.count / total >= 0.02)
    .filter((c) => !borderTop || deltaE(c, borderTop) > 10)
    .slice(0, 6);

  const out = await rawPixels(output, 64);
  const outAll = buckets(out.data);
  const outTotal = outAll.reduce((s, c) => s + c.count, 0);
  const outSignificant = outAll.filter((c) => c.count / outTotal >= 0.003);

  const referencePalette = refMain.map((c) => hex(c.r, c.g, c.b));
  const outputPalette = outAll.slice(0, 6).map((c) => hex(c.r, c.g, c.b));
  if (refMain.length === 0) return { coverage: null, referencePalette, outputPalette };

  const weight = refMain.reduce((s, c) => s + c.count, 0);
  const matched = refMain
    .filter((c) => outSignificant.some((o) => deltaE(c, o) <= COLOR_MATCH_DELTA_E))
    .reduce((s, c) => s + c.count, 0);
  return {
    coverage: Math.round((matched / weight) * 1000) / 1000,
    referencePalette,
    outputPalette,
  };
}

// ------------------------------------------------------------------ Mode F & Mock
function hexToRgb(value: string) {
  const n = Number.parseInt(value.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * MODE F – đặt NGUYÊN ảnh sản phẩm gốc (không tái tạo) lên nền trơn đúng tỷ lệ.
 * Ảnh gốc chỉ được thu nhỏ đồng đều (giữ tỷ lệ), không bị sửa màu/hoa văn.
 */
export async function composeOnBackground(
  product: Buffer,
  aspect: ImageAspect,
  backgroundHex: string,
  scale = 0.84,
): Promise<{ data: Buffer; width: number; height: number }> {
  const { width, height } = CANVAS_SIZE[aspect];
  const fitted = await sh(product)
    .rotate()
    .resize({
      width: Math.round(width * scale),
      height: Math.round(height * scale),
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const data = await sharp({
    create: { width, height, channels: 3, background: hexToRgb(backgroundHex) },
  })
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer();
  return { data, width, height };
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

/**
 * Ảnh MOCK (không phải AI): ảnh tham chiếu đặt lên nền màu + dải chữ "MOCK – KHÔNG PHẢI ẢNH AI".
 * `seed` làm mỗi ảnh khác nhau (tránh trùng SHA-256 trong thư viện).
 */
export async function renderMockImage(
  reference: Buffer,
  aspect: ImageAspect,
  seed: string,
  label: string,
): Promise<Buffer> {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const bg = `hsl(${h},35%,82%)`;
  const { width, height } = CANVAS_SIZE[aspect];
  const fitted = await sh(reference)
    .rotate()
    .resize({ width: Math.round(width * 0.7), height: Math.round(height * 0.6), fit: 'inside' })
    .png()
    .toBuffer();
  const banner = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="${bg}"/>
      <rect x="0" y="0" width="100%" height="${Math.round(height * 0.12)}" fill="#111827" opacity="0.85"/>
      <text x="50%" y="${Math.round(height * 0.075)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.05)}" font-weight="700" fill="#FACC15">MOCK – KHÔNG PHẢI ẢNH AI</text>
      <text x="50%" y="${Math.round(height * 0.95)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(width * 0.028)}" fill="#111827">${escapeXml(label.slice(0, 80))} · ${escapeXml(seed.slice(0, 8))}</text>
    </svg>`,
  );
  return sharp(banner)
    .composite([{ input: fitted, gravity: 'center' }])
    .png()
    .toBuffer();
}
