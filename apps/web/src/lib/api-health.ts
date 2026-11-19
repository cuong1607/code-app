import 'server-only';
import { type HealthResponse, healthResponseSchema, toErrorMessage } from '@acs/shared';

export type ApiHealthResult =
  { ok: true; data: HealthResponse } | { ok: false; error: string; apiUrl: string };

/**
 * Gọi GET /health của API từ phía SERVER Next.js.
 * Chạy server-side để không phụ thuộc CORS và không lộ cấu hình nội bộ.
 */
export async function fetchApiHealth(
  apiUrl: string = process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  fetchImpl: typeof fetch = fetch,
): Promise<ApiHealthResult> {
  try {
    const res = await fetchImpl(`${apiUrl.replace(/\/$/, '')}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    // /health trả 503 kèm body hợp lệ khi thành phần lõi down -> vẫn đọc body
    const json: unknown = await res.json();
    const parsed = healthResponseSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        apiUrl,
        error: `Phản hồi /health không đúng định dạng (HTTP ${res.status})`,
      };
    }
    return { ok: true, data: parsed.data };
  } catch (error) {
    return { ok: false, apiUrl, error: `Không kết nối được API: ${toErrorMessage(error)}` };
  }
}
