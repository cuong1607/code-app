/** Ảnh 1×1 hợp lệ dùng cho kiểm thử (PNG, JPEG, WebP). */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
export const JPEG_1X1 = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64',
);
export const WEBP_1X1 = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

/** PNG 1×1 khác nội dung (đổi màu) – dùng để tránh bị coi là file trùng. */
export function uniquePng(seed: number): Buffer {
  // Thêm chunk tEXt (hợp lệ, bị bỏ qua khi hiển thị) chứa seed -> SHA-256 khác nhau
  const text = Buffer.from(`Comment\0seed-${seed}-${Date.now()}`, 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(text.length);
  const type = Buffer.from('tEXt', 'ascii');
  const crc = Buffer.alloc(4); // CRC sai không ảnh hưởng tới image-size/sniff
  const iend = PNG_1X1.length - 12;
  return Buffer.concat([PNG_1X1.subarray(0, iend), len, type, text, crc, PNG_1X1.subarray(iend)]);
}
