import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError, apiRequest, buildUrl } from './client';

const respond = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('buildUrl', () => {
  it('ghép path và bỏ tham số rỗng', () => {
    expect(buildUrl('http://api/', '/products', { page: 2, search: '', q: 'áo' })).toBe(
      'http://api/products?page=2&q=%C3%A1o',
    );
  });
});

describe('apiRequest', () => {
  it('trả dữ liệu đã kiểm tra bằng schema', async () => {
    const data = await apiRequest('/x', {
      baseUrl: 'http://api',
      fetchImpl: respond(200, { ok: true }),
      schema: z.object({ ok: z.boolean() }),
    });
    expect(data).toEqual({ ok: true });
  });

  it('chuyển ErrorResponse của API thành ApiError có mã lỗi', async () => {
    const error = await apiRequest('/x', {
      baseUrl: 'http://api',
      fetchImpl: respond(503, {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Hàng đợi chưa sẵn sàng',
          requestId: 'r1',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('SERVICE_UNAVAILABLE');
    expect((error as ApiError).requestId).toBe('r1');
  });

  it('báo INVALID_RESPONSE khi dữ liệu sai schema', async () => {
    const error = await apiRequest('/x', {
      baseUrl: 'http://api',
      fetchImpl: respond(200, { ok: 'không' }),
      schema: z.object({ ok: z.boolean() }),
    }).catch((e: unknown) => e);
    expect((error as ApiError).code).toBe('INVALID_RESPONSE');
  });

  it('báo NETWORK_ERROR khi không kết nối được', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const error = await apiRequest('/x', { baseUrl: 'http://api', fetchImpl: failing }).catch(
      (e: unknown) => e,
    );
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
  });
});
