/**
 * SMOKE TEST ẢNH AI THẬT (Phase 04) – GỌI GEMINI/OPENAI THẬT, CÓ PHÁT SINH CHI PHÍ (1 ẢNH).
 *
 * Yêu cầu: API đang chạy (pnpm dev, worker ảnh bật) + provider đã cấu hình (vd GOOGLE_API_KEY trong .env).
 * Chạy:   pnpm ai:image-smoke -- <productId>            (provider mặc định gemini)
 *         pnpm ai:image-smoke -- <productId> openai
 * Không truyền productId -> dùng sản phẩm Home & Living đầu tiên có ảnh gốc.
 *
 * Luồng (theo tiêu chí nghiệm thu 04D):
 *   sản phẩm thật -> 1 ảnh tham chiếu từ MinIO -> template gợi ý -> ước tính chi phí (dừng nếu > SMOKE_MAX_USD)
 *   -> 1 tác vụ AI thật (count = 1) -> chờ worker -> kiểm tra file đầu ra trên MinIO -> in link Image Studio
 *   để BẠN so sánh với ảnh gốc, duyệt và chuyển sang Video Factory (bước kiểm tra chất lượng do người làm).
 */
import { imageEstimateSchema, imageJobDetailSchema, imageProductContextSchema } from '@acs/shared';

const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:4000';
const WEB = process.env.SMOKE_WEB_URL ?? 'http://127.0.0.1:3000';
const MAX_USD = Number(process.env.SMOKE_MAX_USD ?? '0.25');
const args = process.argv.slice(2).filter((a) => a !== '--');
const provider = args.find((a) => ['gemini', 'openai'].includes(a)) ?? 'gemini';
let productId = args.find((a) => /^[0-9a-f-]{36}$/i.test(a));

async function call<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T & { error?: { code: string; message: string } };
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${json.error?.code}: ${json.error?.message}`,
    );
  return json;
}

async function main() {
  const providers = await call<{ providers: { id: string; status: string; message: string }[] }>(
    'GET',
    '/images/providers',
  );
  const st = providers.providers.find((p) => p.id === provider);
  if (st?.status !== 'ready') {
    console.error(
      `\n✗ Provider "${provider}" chưa sẵn sàng: ${st?.message ?? 'không có'}.\n` +
        '  Tạo ảnh AI thật CHƯA được xác minh. Đặt GOOGLE_API_KEY (hoặc OPENAI_API_KEY + OPENAI_IMAGE_MODEL +\n' +
        '  OPENAI_IMAGE_PRICE_PER_IMAGE_USD) trong .env rồi khởi động lại API.\n',
    );
    process.exit(2);
  }
  const check = await call<{ ok: boolean; message: string }>(
    'POST',
    `/images/providers/${provider}/check`,
    {},
  );
  console.log(`Kiểm tra kết nối ${provider}: ${check.ok ? 'OK' : 'LỖI'} – ${check.message}`);
  if (!check.ok) process.exit(1);

  if (!productId) {
    const list = await call<{ items: { id: string; name: string; imageCount: number }[] }>(
      'GET',
      '/products?pageSize=100&status=active',
    );
    for (const p of list.items.filter((x) => x.imageCount > 0)) {
      const ctx = imageProductContextSchema.parse(
        await call('GET', `/images/products/${p.id}/context`),
      );
      if (ctx.visualContext.kind && ctx.references.length) {
        productId = p.id;
        break;
      }
    }
  }
  if (!productId)
    throw new Error('Không tìm thấy sản phẩm Home & Living có ảnh gốc – truyền productId');
  const ctx = imageProductContextSchema.parse(
    await call('GET', `/images/products/${productId}/context?mode=lifestyle_interior`),
  );
  const tpl = ctx.templates.find((m) => m.recommended) ?? ctx.templates.find((m) => m.applicable);
  if (!tpl || !ctx.references[0])
    throw new Error('Sản phẩm không có template phù hợp hoặc ảnh gốc');
  console.log(
    `Sản phẩm: ${ctx.visualContext.productName} (${ctx.visualContext.kind}) · template ${tpl.template.id}`,
  );

  const req = {
    productId,
    referenceAssetIds: [ctx.references[0].id],
    mode: 'lifestyle_interior',
    templateId: tpl.template.id,
    aspect: '9:16',
    count: 1,
    provider,
  };
  const est = imageEstimateSchema.parse(await call('POST', '/images/estimate', req));
  console.log(`Ước tính: $${est.estimatedCostUsd} (${est.pricingSource})`);
  if (!est.allowed) throw new Error(`Bị chặn: ${est.reason}`);
  if (Number(est.estimatedCostUsd) > MAX_USD)
    throw new Error(`Ước tính vượt SMOKE_MAX_USD=$${MAX_USD} – dừng`);

  let job = imageJobDetailSchema.parse(
    await call('POST', '/images/jobs', { ...req, idempotencyKey: crypto.randomUUID() }),
  );
  const started = Date.now();
  while (['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(job.status)) {
    if (Date.now() - started > 6 * 60_000)
      throw new Error('Quá 6 phút chưa xong – kiểm tra log API');
    await new Promise((r) => setTimeout(r, 3000));
    job = imageJobDetailSchema.parse(await call('GET', `/images/jobs/${job.id}`));
    process.stdout.write(`  ${job.items[0]?.stage ?? job.status}\r`);
  }
  const item = job.items[0]!;
  if (job.status !== 'COMPLETED' || !item.asset?.previewUrl) {
    throw new Error(`Tác vụ ${job.status}: ${item.errorMessage ?? job.errorMessage ?? ''}`);
  }
  const file = await fetch(item.asset.previewUrl);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!file.ok || bytes.length !== item.asset.fileSize)
    throw new Error('File trên MinIO không khớp bản ghi');
  console.log(
    `\n✓ Ảnh AI thật đã lưu MinIO: ${item.asset.width}×${item.asset.height}, ${bytes.length} byte, ` +
      `model ${job.model}, ${((item.latencyMs ?? 0) / 1000).toFixed(1)} giây, chi phí ước tính $${item.estimatedCostUsd}.`,
  );
  console.log(`  Kiểm tra màu tự động: ${item.autoCheck?.colorCoverage ?? 'n/a'} (tham khảo)`);
  console.log(
    `\nBước do NGƯỜI kiểm tra: mở ${WEB}/studio/images -> chọn tác vụ "${job.productName}" -> So sánh với ảnh gốc ->` +
      ' Duyệt/Từ chối -> "Sử dụng làm ảnh đầu vào Video Factory".',
  );
}

main().catch((e: unknown) => {
  console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
