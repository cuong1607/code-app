import { describe, expect, it } from 'vitest';
import { fetchApiHealth } from './api-health';

const healthBody = {
  status: 'degraded',
  service: 'api',
  version: '0.0.0',
  uptimeSeconds: 5,
  timestamp: '2026-01-01T00:00:00.000Z',
  components: {
    database: { status: 'up', latencyMs: 2 },
    redis: { status: 'up', latencyMs: 1 },
    storage: { status: 'up', latencyMs: 3 },
    worker: { status: 'down', message: 'Không có heartbeat' },
  },
};

const fakeFetch = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('fetchApiHealth', () => {
  it('đọc và kiểm tra schema phản hồi hợp lệ', async () => {
    const result = await fetchApiHealth('http://api.test', fakeFetch(200, healthBody));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.components.worker.status).toBe('down');
  });

  it('vẫn đọc body khi API trả 503', async () => {
    const result = await fetchApiHealth(
      'http://api.test',
      fakeFetch(503, { ...healthBody, status: 'down' }),
    );
    expect(result.ok && result.data.status).toBe('down');
  });

  it('báo lỗi khi phản hồi sai định dạng', async () => {
    const result = await fetchApiHealth('http://api.test', fakeFetch(200, { hello: 'world' }));
    expect(result.ok).toBe(false);
  });

  it('báo lỗi khi không kết nối được', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    const result = await fetchApiHealth('http://api.test', failing);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('fetch failed');
  });
});
