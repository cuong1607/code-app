import { createHash } from 'node:crypto';
import { imageSize } from 'image-size';
import { type AllowedImageMime, AppError, IMAGE_EXTENSION } from '@acs/shared';

/** Giới hạn kích thước ảnh để chống "decompression bomb". */
export const MAX_IMAGE_SIDE = 16_384;
export const MAX_IMAGE_PIXELS = 80_000_000;

/** Nhận diện định dạng ảnh từ NỘI DUNG (magic bytes) – không tin MIME client gửi. */
export function sniffImageMime(buf: Buffer): AllowedImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function sha256Hex(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export interface InspectedImage {
  mimeType: AllowedImageMime;
  extension: string;
  width: number;
  height: number;
  sha256: string;
  size: number;
}

/**
 * Xác minh file là ảnh hợp lệ: định dạng thật, đọc được kích thước, không quá lớn.
 * Ném AppError VALIDATION_ERROR với thông báo tiếng Việt nếu không hợp lệ.
 */
export function inspectImage(buf: Buffer, declaredMime?: string): InspectedImage {
  if (buf.length === 0) throw new AppError('VALIDATION_ERROR', 'File rỗng');
  const mimeType = sniffImageMime(buf);
  if (!mimeType) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Nội dung file không phải ảnh JPG, PNG hoặc WebP hợp lệ',
    );
  }
  if (declaredMime && declaredMime !== mimeType) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Nội dung file (${mimeType}) không khớp định dạng khai báo (${declaredMime})`,
    );
  }
  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = imageSize(buf));
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Không đọc được kích thước ảnh – file có thể bị hỏng');
  }
  if (!width || !height) throw new AppError('VALIDATION_ERROR', 'Không đọc được kích thước ảnh');
  if (width > MAX_IMAGE_SIDE || height > MAX_IMAGE_SIDE || width * height > MAX_IMAGE_PIXELS) {
    throw new AppError('VALIDATION_ERROR', `Ảnh quá lớn (${width}×${height}px)`);
  }
  return {
    mimeType,
    extension: IMAGE_EXTENSION[mimeType],
    width,
    height,
    sha256: sha256Hex(buf),
    size: buf.length,
  };
}

/** Làm sạch tên file hiển thị/tải xuống: bỏ đường dẫn, ký tự điều khiển, giới hạn độ dài. */
export function sanitizeFilename(original: string, extension: string): string {
  const base = original
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'anh'}.${extension}`;
}
