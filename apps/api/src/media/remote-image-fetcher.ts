import { type LookupAddress, lookup as dnsLookup } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { AppError, toErrorMessage } from '@acs/shared';
import { type InspectedImage, inspectImage } from './image-inspector';

const MAX_REDIRECTS = 3;

/** IP thuộc dải nội bộ/đặc biệt -> cấm (chống SSRF vào mạng nội bộ, metadata cloud…). */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / metadata cloud
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast + reserved
    );
  }
  if (net.isIPv6(ip)) {
    const s = ip.toLowerCase();
    return (
      s === '::' ||
      s === '::1' ||
      s.startsWith('fc') ||
      s.startsWith('fd') || // unique local
      s.startsWith('fe8') ||
      s.startsWith('fe9') ||
      s.startsWith('fea') ||
      s.startsWith('feb') || // link-local
      s.startsWith('ff') // multicast
    );
  }
  return true; // không nhận diện được -> coi là không an toàn
}

/** Tên miền khớp chính xác hoặc là tên miền con của một mục trong allowlist. */
export function isHostAllowed(hostname: string, allowed: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return allowed.some((h) => host === h || host.endsWith(`.${h}`));
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** DNS lookup chặn IP nội bộ – dùng NGAY khi mở kết nối (không có khe hở DNS rebinding). */
function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) {
      const e = new Error(
        `Tên miền ${hostname} trỏ tới địa chỉ nội bộ – bị chặn`,
      ) as NodeJS.ErrnoException;
      e.code = 'EBLOCKED';
      return callback(e, '');
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0]!.address, list[0]!.family);
  });
}

export interface FetchedImage extends InspectedImage {
  buffer: Buffer;
  finalUrl: string;
}

export class RemoteImageFetcher {
  constructor(
    private readonly allowedHosts: readonly string[],
    private readonly maxBytes: number,
    private readonly timeoutMs = 10_000,
  ) {}

  get enabled(): boolean {
    return this.allowedHosts.length > 0;
  }

  /** Kiểm tra chính sách cho 1 URL (không gọi mạng). */
  assertAllowed(rawUrl: string): URL {
    if (!this.enabled) {
      throw new AppError(
        'FORBIDDEN',
        'Tải ảnh từ URL đang TẮT. Quản trị viên cần cấu hình IMPORT_IMAGE_ALLOWED_HOSTS (danh sách tên miền nguồn đã được phép sử dụng ảnh).',
      );
    }
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new AppError('VALIDATION_ERROR', 'URL ảnh không hợp lệ');
    }
    if (url.protocol !== 'https:') throw new AppError('FORBIDDEN', 'Chỉ hỗ trợ tải ảnh qua https');
    if (url.username || url.password)
      throw new AppError('FORBIDDEN', 'URL không được chứa thông tin đăng nhập');
    if (url.port && url.port !== '443') throw new AppError('FORBIDDEN', 'Chỉ cho phép cổng 443');
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) {
      throw new AppError('FORBIDDEN', 'Không cho phép URL dùng địa chỉ IP trực tiếp');
    }
    if (!isHostAllowed(url.hostname, this.allowedHosts)) {
      throw new AppError(
        'FORBIDDEN',
        `Tên miền "${url.hostname}" chưa nằm trong danh sách được phép (IMPORT_IMAGE_ALLOWED_HOSTS)`,
      );
    }
    return url;
  }

  async fetch(rawUrl: string): Promise<FetchedImage> {
    let url = this.assertAllowed(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const res = await this.request(url);
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (hop === MAX_REDIRECTS)
          throw new AppError('VALIDATION_ERROR', 'Quá nhiều lần chuyển hướng');
        // Mỗi bước chuyển hướng phải qua lại toàn bộ kiểm tra chính sách
        url = this.assertAllowed(new URL(res.headers.location, url).toString());
        continue;
      }
      if (res.statusCode !== 200) {
        res.resume();
        throw new AppError(
          'VALIDATION_ERROR',
          `Nguồn ảnh trả về HTTP ${res.statusCode} – có thể không cho phép truy cập`,
        );
      }
      const type = String(res.headers['content-type'] ?? '')
        .split(';')[0]!
        .trim()
        .toLowerCase();
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
        res.resume();
        throw new AppError(
          'VALIDATION_ERROR',
          `Nguồn trả về loại nội dung không hỗ trợ (${type || 'không rõ'})`,
        );
      }
      const declared = Number(res.headers['content-length'] ?? 0);
      if (declared > this.maxBytes) {
        res.resume();
        throw new AppError('VALIDATION_ERROR', 'Ảnh nguồn vượt quá dung lượng cho phép');
      }
      const buffer = await this.readCapped(res);
      return { ...inspectImage(buffer), buffer, finalUrl: url.toString() };
    }
    throw new AppError('VALIDATION_ERROR', 'Quá nhiều lần chuyển hướng');
  }

  private request(url: URL): Promise<IncomingMessage> {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          lookup: safeLookup as unknown as typeof dnsLookup,
          timeout: this.timeoutMs,
          headers: {
            'user-agent': 'AIContentStudio-ImageFetcher/0.2',
            accept: 'image/jpeg,image/png,image/webp',
          },
        },
        resolve,
      );
      req.on('timeout', () => req.destroy(new Error('Hết thời gian chờ nguồn ảnh')));
      req.on('error', (err: NodeJS.ErrnoException) => {
        reject(
          err.code === 'EBLOCKED'
            ? new AppError('FORBIDDEN', err.message)
            : new AppError('SERVICE_UNAVAILABLE', `Không tải được ảnh: ${toErrorMessage(err)}`),
        );
      });
    });
  }

  private readCapped(res: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > this.maxBytes) {
          res.destroy();
          reject(new AppError('VALIDATION_ERROR', 'Ảnh nguồn vượt quá dung lượng cho phép'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', (err) =>
        reject(new AppError('SERVICE_UNAVAILABLE', `Lỗi khi tải ảnh: ${toErrorMessage(err)}`)),
      );
    });
  }
}
