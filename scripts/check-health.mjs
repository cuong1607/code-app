#!/usr/bin/env node
/**
 * Kiểm tra nhanh toàn hệ thống: gọi GET /health của API và in kết quả.
 * Dùng: pnpm health   (hoặc API_URL=http://host:4000 pnpm health)
 * Exit code: 0 = ok/degraded, 1 = down hoặc không kết nối được.
 */
const apiUrl = (
  process.env.API_URL ??
  process.env.API_INTERNAL_URL ??
  'http://localhost:4000'
).replace(/\/$/, '');

const icons = { up: '✅', down: '❌' };

try {
  const res = await fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(8000) });
  const body = await res.json();
  console.log(`API ${apiUrl} -> HTTP ${res.status}, trạng thái tổng: ${body.status}`);
  for (const [name, c] of Object.entries(body.components ?? {})) {
    const latency = c.latencyMs !== undefined ? ` (${c.latencyMs} ms)` : '';
    const msg = c.message ? ` - ${c.message}` : '';
    console.log(`  ${icons[c.status] ?? '?'} ${name.padEnd(9)} ${c.status}${latency}${msg}`);
  }
  process.exit(body.status === 'down' ? 1 : 0);
} catch (error) {
  console.error(
    `❌ Không gọi được ${apiUrl}/health: ${error instanceof Error ? error.message : error}`,
  );
  console.error('   Hãy chắc chắn API đang chạy: pnpm dev:api');
  process.exit(1);
}
