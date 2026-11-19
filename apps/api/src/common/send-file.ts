import type { Response } from 'express';

/** Gửi file tải xuống với tên file UTF-8 an toàn (RFC 6266 / 5987). */
export function sendFile(
  res: Response,
  file: { buffer: Buffer; filename: string; contentType: string },
): void {
  const ascii =
    file.filename
      .normalize('NFD')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '') || 'download';
  res.setHeader('Content-Type', file.contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  );
  res.setHeader('Content-Length', String(file.buffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.end(file.buffer);
}
