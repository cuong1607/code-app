import { describe, expect, it } from 'vitest';
import { RemoteImageFetcher, isHostAllowed, isPrivateAddress } from './remote-image-fetcher';

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:10.0.0.1',
  ])('%s bị chặn', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('%s được phép', (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe('isHostAllowed', () => {
  it('khớp chính xác hoặc tên miền con, không khớp tên miền giả mạo', () => {
    const allowed = ['cdn.shop.vn'];
    expect(isHostAllowed('cdn.shop.vn', allowed)).toBe(true);
    expect(isHostAllowed('img.cdn.shop.vn', allowed)).toBe(true);
    expect(isHostAllowed('evilcdn.shop.vn', allowed)).toBe(false);
    expect(isHostAllowed('cdn.shop.vn.evil.com', allowed)).toBe(false);
  });
});

describe('RemoteImageFetcher', () => {
  it('tắt mặc định khi chưa cấu hình allowlist', () => {
    const f = new RemoteImageFetcher([], 1024);
    expect(() => f.assertAllowed('https://cdn.shop.vn/a.jpg')).toThrow(/đang TẮT/);
  });

  it('từ chối http, IP trực tiếp, thông tin đăng nhập, cổng lạ, tên miền ngoài danh sách', () => {
    const f = new RemoteImageFetcher(['cdn.shop.vn'], 1024);
    expect(() => f.assertAllowed('http://cdn.shop.vn/a.jpg')).toThrow(/https/);
    expect(() => f.assertAllowed('https://93.184.216.34/a.jpg')).toThrow(/địa chỉ IP/);
    expect(() => f.assertAllowed('https://u:p@cdn.shop.vn/a.jpg')).toThrow(/đăng nhập/);
    expect(() => f.assertAllowed('https://cdn.shop.vn:8443/a.jpg')).toThrow(/443/);
    expect(() => f.assertAllowed('https://other.vn/a.jpg')).toThrow(/chưa nằm trong/);
  });

  it('chặn tên miền được phép nhưng trỏ về địa chỉ nội bộ (chống SSRF)', async () => {
    const f = new RemoteImageFetcher(['localhost'], 1024, 3000);
    await expect(f.fetch('https://localhost/a.png')).rejects.toThrow(/nội bộ/);
  });
});
