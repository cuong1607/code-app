import { describe, expect, it } from 'vitest';
import { AppError } from '@acs/shared';
import { JPEG_1X1, PNG_1X1, WEBP_1X1, uniquePng } from '../../test/fixtures/images';
import { inspectImage, sanitizeFilename, sniffImageMime } from './image-inspector';

describe('sniffImageMime', () => {
  it('nhận diện đúng PNG/JPEG/WebP theo nội dung', () => {
    expect(sniffImageMime(PNG_1X1)).toBe('image/png');
    expect(sniffImageMime(JPEG_1X1)).toBe('image/jpeg');
    expect(sniffImageMime(WEBP_1X1)).toBe('image/webp');
  });

  it('từ chối file giả mạo (text đổi đuôi .png)', () => {
    expect(sniffImageMime(Buffer.from('<?php echo 1; ?>'))).toBeNull();
  });
});

describe('inspectImage', () => {
  it('đọc kích thước + hash cho cả 3 định dạng', () => {
    for (const buf of [PNG_1X1, JPEG_1X1, WEBP_1X1]) {
      const r = inspectImage(buf);
      expect(r.width).toBe(1);
      expect(r.height).toBe(1);
      expect(r.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('ảnh có chunk phụ vẫn hợp lệ và có hash khác', () => {
    const a = inspectImage(uniquePng(1));
    const b = inspectImage(uniquePng(2));
    expect(a.sha256).not.toBe(b.sha256);
  });

  it('báo lỗi khi nội dung không khớp MIME khai báo', () => {
    expect(() => inspectImage(PNG_1X1, 'image/jpeg')).toThrow(/không khớp/);
  });

  it('báo lỗi với file không phải ảnh và file rỗng', () => {
    expect(() => inspectImage(Buffer.from('hello'))).toThrow(AppError);
    expect(() => inspectImage(Buffer.alloc(0))).toThrow('File rỗng');
  });
});

describe('sanitizeFilename', () => {
  it('bỏ đường dẫn & ký tự nguy hiểm, giữ tiếng Việt, đặt đuôi theo định dạng thật', () => {
    expect(sanitizeFilename('..\\..\\Áo thun <đỏ>.PNG', 'png')).toBe('Áo thun đỏ.png');
    expect(sanitizeFilename('/etc/passwd', 'jpg')).toBe('passwd.jpg');
    expect(sanitizeFilename('.png', 'png')).toBe('anh.png');
  });
});
