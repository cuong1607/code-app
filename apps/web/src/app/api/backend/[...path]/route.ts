/**
 * Proxy cùng origin: /api/backend/* -> NestJS API (API_INTERNAL_URL).
 * Trình duyệt chỉ gọi origin của web; API nội bộ không cần mở CORS ra ngoài.
 * Không chuyển tiếp cookie/authorization ở Phase 01 (chưa có xác thực).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { nowUtcIso, toErrorMessage } from '@acs/shared';

const TIMEOUT_MS = 30_000;
const FORWARD_HEADERS = ['content-type', 'accept', 'x-request-id'];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const base = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const target = `${base}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    const responseHeaders = new Headers();
    for (const name of ['content-type', 'x-request-id']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `Không kết nối được API: ${toErrorMessage(error)}`,
          timestamp: nowUtcIso(),
        },
      },
      { status: 502 },
    );
  }
}

export { proxy as DELETE, proxy as GET, proxy as PATCH, proxy as POST, proxy as PUT };
