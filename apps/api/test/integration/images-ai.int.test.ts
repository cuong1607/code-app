import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { imageQueueJobId } from '@acs/shared';
import { ImageProviderRegistry } from '../../src/ai/image/image-provider.registry';
import { GeminiImageProvider } from '../../src/ai/image/providers/gemini-image-provider';
import { MockImageProvider } from '../../src/ai/image/providers/mock-image-provider';
import { ImageItemProcessor } from '../../src/images/image-item.processor';
import { ImageQueueService } from '../../src/images/image-queue.service';
import { sha256Hex } from '../../src/media/image-inspector';
import { StorageService } from '../../src/storage/storage.service';
import { type Harness, startApp, uploadImage } from './app-harness';

/**
 * Kiểm thử tích hợp AI Image Studio: PostgreSQL + MinIO + Redis THẬT, provider = Mock
 * (KHÔNG gọi AI thật). Worker tự động tắt (IMAGE_WORKER_ENABLED=false) để test điều khiển
 * từng bước; có test riêng chạy worker BullMQ thật + khôi phục sau "restart".
 */
const RUN = Date.now().toString(36).toUpperCase();
const P = `IM${RUN}`;
const OTHER_WS = randomUUID();
let h: Harness;
let mock: MockImageProvider;
let processor: ImageItemProcessor;
let queue: ImageQueueService;
let storage: StorageService;
const products: Record<string, string> = {};
const refs: Record<string, string> = {};
let originalPrefs: Record<string, unknown>;
const geminiCalls: unknown[] = [];

/** Ảnh sản phẩm "thật": nền trắng + chăn xanh dương có chấm trắng (hoa văn). */
async function productPhoto(color: string, seed: number) {
  const dots = Array.from({ length: 12 }, (_, i) => ({
    input: Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="8" fill="#FFFFFF"/></svg>`,
    ),
    left: 70 + (i % 4) * 30,
    top: 80 + Math.floor(i / 4) * 30 + (seed % 5),
  }));
  const blanket = await sharp({
    create: { width: 180, height: 140, channels: 3, background: color },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width: 320, height: 320, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: blanket, left: 70, top: 90 }, ...dots])
    .png()
    .toBuffer();
}

const body = (over: Record<string, unknown> = {}) => ({
  productId: products.bedding,
  referenceAssetIds: [refs.bedding],
  mode: 'lifestyle_interior',
  templateId: 'luxury_bedroom',
  aspect: '9:16',
  count: 1,
  provider: 'mock',
  idempotencyKey: randomUUID(),
  ...over,
});

async function processAll(jobId: string) {
  const items = await h.prisma.imageGenerationItem.findMany({
    where: { jobId, status: 'QUEUED' },
    orderBy: { index: 'asc' },
  });
  const out: string[] = [];
  for (const it of items) {
    out.push(
      await processor.process(
        { workspaceId: it.workspaceId, jobId, itemId: it.id },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    );
  }
  return out;
}

beforeAll(async () => {
  process.env.AI_MOCK_PROVIDER_ENABLED = 'true';
  process.env.AI_RATE_LIMIT_PER_MINUTE = '1000';
  process.env.IMAGE_RATE_LIMIT_PER_MINUTE = '600';
  process.env.IMAGE_WORKER_ENABLED = 'false';
  process.env.IMAGE_MAX_ATTEMPTS = '2';
  // Gemini "đã có key" (giả) để kiểm tra trạng thái & ngân sách – client giả, KHÔNG gọi mạng
  process.env.GOOGLE_API_KEY = 'test-google-key-not-real';
  // OpenAI có key + model nhưng KHÔNG có đơn giá -> phải bị từ chối trước khi gọi
  process.env.OPENAI_API_KEY = 'test-openai-key-not-real';
  process.env.OPENAI_IMAGE_MODEL = 'test-image-model';
  delete process.env.OPENAI_IMAGE_PRICE_PER_IMAGE_USD;
  h = await startApp();
  const registry = h.app.get(ImageProviderRegistry);
  mock = registry.get('mock') as MockImageProvider;
  registry.override(
    'gemini',
    new GeminiImageProvider({ imageSize: '1K' }, () => ({
      interactions: {
        create: (p) => {
          geminiCalls.push(p);
          return Promise.reject(Object.assign(new Error('không được gọi'), { status: 500 }));
        },
      },
      models: { get: () => Promise.resolve({}) },
    })),
  );
  processor = h.app.get(ImageItemProcessor);
  queue = h.app.get(ImageQueueService);
  storage = h.app.get(StorageService);

  const settings = await h.http().get('/settings');
  originalPrefs = { ai: settings.body.preferences.ai, images: settings.body.preferences.images };
  await h
    .http()
    .put('/settings')
    .send({
      preferences: {
        ai: { perGenerationBudgetUsd: 1, dailyBudgetUsd: 5 },
        images: { requireApprovalForVideo: true },
      },
    });

  const defs = {
    bedding: {
      sku: `${P}-BO`,
      name: 'Bộ chăn ga gối Cotton Hoa Nhí',
      category: 'Chăn ga gối',
      attributes: {
        'Màu sắc': 'Xanh dương',
        'Họa tiết': 'Chấm bi trắng',
        'Bộ gồm': '1 ga, 2 vỏ gối, 1 vỏ chăn',
        'Kích thước': '1m6 x 2m',
      },
      costPrice: 300000,
    },
    rug: {
      sku: `${P}-THAM`,
      name: 'Thảm phòng khách lông ngắn',
      category: 'Thảm',
      attributes: { 'Hình dạng': 'Chữ nhật' },
    },
  };
  for (const [key, d] of Object.entries(defs)) {
    const res = await h
      .http()
      .post('/products')
      .send({ ...d, sellingPrice: 500000, status: 'active' });
    expect(res.status).toBe(201);
    products[key] = res.body.id;
    const img = await productPhoto(key === 'bedding' ? '#1E4DB7' : '#8B5A2B', RUN.length);
    const up = await uploadImage(h, { name: `${P}-${key}.png`, type: 'image/png', body: img });
    expect(up.complete?.status).toBe(200);
    refs[key] = up.complete!.body.asset.id;
    const att = await h
      .http()
      .post(`/products/${products[key]}/media`)
      .send({ mediaAssetIds: [refs[key]] });
    expect(att.status).toBe(201);
  }
});

afterAll(async () => {
  await h.http().put('/settings').send({ preferences: originalPrefs });
  const jobs = await h.prisma.imageGenerationJob.findMany({
    where: {
      productName: { in: ['Bộ chăn ga gối Cotton Hoa Nhí', 'Thảm phòng khách lông ngắn'] },
      product: { sku: { startsWith: P } },
    },
    include: { items: true },
  });
  const assetIds = jobs
    .flatMap((j) => j.items.map((i) => i.mediaAssetId))
    .filter((x): x is string => !!x);
  for (const j of jobs)
    for (const i of j.items)
      await queue.queue
        .getJob(imageQueueJobId(i.id))
        .then((b) => b?.remove())
        .catch(() => undefined);
  await h.prisma.aiUsage.deleteMany({ where: { imageJobId: { in: jobs.map((j) => j.id) } } });
  await h.prisma.videoDraft.deleteMany({ where: { batchKey: { startsWith: P } } });
  await h.prisma.imageGenerationJob.deleteMany({ where: { id: { in: jobs.map((j) => j.id) } } });
  for (const id of [...assetIds, ...Object.values(refs)])
    await h.http().delete(`/media/${id}?force=true`);
  await h.prisma.product.deleteMany({ where: { sku: { startsWith: P } } });
  await h.prisma.workspace.deleteMany({ where: { id: OTHER_WS } });
  await h.app.close();
});

describe('Provider & ngữ cảnh sản phẩm', () => {
  it('liệt kê provider không lộ API key; mock sẵn sàng; template ≥ 10', async () => {
    const res = await h.http().get('/images/providers');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('test-google-key-not-real');
    expect(text).not.toContain('test-openai-key-not-real');
    const byId = Object.fromEntries(res.body.providers.map((p: { id: string }) => [p.id, p]));
    expect(byId.mock).toMatchObject({ status: 'ready', isMock: true });
    expect(byId.gemini.status).toBe('ready');
    expect(byId.openai.models[0].pricingKnown).toBe(false);
    const t = await h.http().get('/images/templates');
    expect(t.body.templates.length).toBeGreaterThanOrEqual(10);
  });

  it('ngữ cảnh: lấy sản phẩm thật từ PostgreSQL + ảnh gốc từ MinIO, nhận diện bộ chăn ga, không có giá vốn', async () => {
    const res = await h.http().get(`/images/products/${products.bedding}/context`);
    expect(res.status).toBe(200);
    expect(res.body.visualContext).toMatchObject({
      kind: 'bedding_set',
      group: 'bedding',
      imageAnalysis: 'none',
    });
    expect(res.body.visualContext.itemCounts).toHaveLength(3);
    expect(res.body.references.map((r: { id: string }) => r.id)).toEqual([refs.bedding]);
    const preview = await fetch(res.body.references[0].previewUrl);
    expect(preview.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('300000');
    const rec = res.body.templates
      .filter((m: { recommended: boolean }) => m.recommended)
      .map((m: { template: { id: string } }) => m.template.id);
    expect(rec).toContain('bedding_arrangement');
    const rug = await h.http().get(`/images/products/${products.rug}/context`);
    expect(rug.body.templates[0].template.id).toBe('modern_living_room_rug');
  });
});

describe('Ngân sách & ước tính', () => {
  it('ước tính mock: chi phí 0, có xem trước prompt chứa đúng dữ kiện', async () => {
    const res = await h
      .http()
      .post('/images/estimate')
      .send(body({ count: 3, mode: 'batch_variations' }));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      allowed: true,
      isMock: true,
      pricingKnown: true,
      estimatedCostUsd: '0.000000',
    });
    expect(res.body.promptPreview.prompt).toContain('Xanh dương');
    expect(res.body.promptPreview.prompt).toContain('2 pillowcase(s)');
  });

  it('OpenAI chưa có đơn giá -> 402, không tạo tác vụ, không gọi provider', async () => {
    const before = await h.prisma.imageGenerationJob.count();
    const est = await h
      .http()
      .post('/images/estimate')
      .send(body({ provider: 'openai' }));
    expect(est.body.allowed).toBe(false);
    expect(est.body.pricingKnown).toBe(false);
    const res = await h
      .http()
      .post('/images/jobs')
      .send(body({ provider: 'openai' }));
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('BUDGET_EXCEEDED');
    expect(await h.prisma.imageGenerationJob.count()).toBe(before);
  });

  it('vượt ngân sách mỗi lần tạo (Gemini 3 ảnh) -> 402 trước khi gọi API', async () => {
    await h
      .http()
      .put('/settings')
      .send({ preferences: { ai: { perGenerationBudgetUsd: 0.1 } } });
    const res = await h
      .http()
      .post('/images/jobs')
      .send(body({ provider: 'gemini', count: 3, mode: 'batch_variations' }));
    expect(res.status).toBe(402);
    expect(res.body.error.message).toMatch(/vượt ngân sách mỗi lần tạo/);
    expect(geminiCalls).toHaveLength(0);
    await h
      .http()
      .put('/settings')
      .send({ preferences: { ai: { perGenerationBudgetUsd: 1 } } });
  });
});

describe('Tác vụ tạo ảnh (job → worker → MinIO)', () => {
  let jobId: string;
  let itemIds: string[];

  it('tạo tác vụ 3 biến thể: lưu job + item trong DB, idempotent khi gửi lại', async () => {
    const payload = body({ count: 3, mode: 'batch_variations', userPrompt: 'Thêm cây xanh nhỏ' });
    const res = await h.http().post('/images/jobs').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'QUEUED',
      requestedCount: 3,
      isMock: true,
      usesAi: true,
    });
    expect(res.body.items).toHaveLength(3);
    expect(new Set(res.body.items.map((i: { prompt: string }) => i.prompt)).size).toBe(3);
    jobId = res.body.id;
    itemIds = res.body.items.map((i: { id: string }) => i.id);
    const again = await h.http().post('/images/jobs').send(payload);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(jobId);
    expect(await h.prisma.imageGenerationItem.count({ where: { jobId } })).toBe(3);
  });

  it('xử lý: ảnh lưu vào MinIO, MediaAsset AI_IMAGE chưa vào thư viện, ghi ai_usage, ảnh gốc không đổi', async () => {
    const refBefore = await h.prisma.mediaAsset.findUnique({ where: { id: refs.bedding } });
    expect(await processAll(jobId)).toEqual(['completed', 'completed', 'completed']);
    const res = await h.http().get(`/images/jobs/${jobId}`);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.counts).toMatchObject({ completed: 3, failed: 0 });
    for (const it of res.body.items) {
      expect(it).toMatchObject({
        status: 'COMPLETED',
        stage: 'done',
        approvalStatus: 'pending',
        savedToLibrary: false,
      });
      expect(it.asset).toMatchObject({
        assetType: 'AI_IMAGE',
        sourceType: 'generated',
        inLibrary: false,
      });
      expect(it.asset.metadata).toMatchObject({
        isMock: true,
        templateId: 'luxury_bedroom',
        imageJobId: jobId,
        productId: products.bedding,
      });
      expect(it.autoCheck.fit.mode).toBe('none');
      expect(it.asset.width / it.asset.height).toBeCloseTo(9 / 16, 2);
      const file = await fetch(it.asset.previewUrl);
      expect(file.status).toBe(200);
    }
    const usage = await h.prisma.aiUsage.findMany({ where: { imageJobId: jobId } });
    expect(usage).toHaveLength(3);
    expect(usage.every((u) => u.feature === 'image_generate' && u.status === 'success')).toBe(true);
    // Ảnh gốc bất biến: bản ghi + nội dung MinIO không đổi
    const refAfter = await h.prisma.mediaAsset.findUnique({ where: { id: refs.bedding } });
    expect(refAfter).toEqual(refBefore);
    const buf = await storage.getBuffer(refAfter!.storageKey, 10_000_000);
    expect(sha256Hex(buf)).toBe(refBefore!.sha256);
    // Ảnh chưa lưu không hiện ở Thư viện media
    const lib = await h.http().get('/media').query({ type: 'AI_IMAGE', pageSize: 100 });
    const libIds = lib.body.items.map((a: { id: string }) => a.id);
    expect(res.body.items.some((i: { asset: { id: string } }) => libIds.includes(i.asset.id))).toBe(
      false,
    );
  });

  it('xử lý lại job đã xong -> bỏ qua (idempotent), không gọi provider thêm', async () => {
    const calls = mock.calls.length;
    const r = await processor.process(
      { workspaceId: h.env.DEV_WORKSPACE_ID, jobId, itemId: itemIds[0]! },
      { attemptsMade: 0, maxAttempts: 2 },
    );
    expect(r).toBe('skipped');
    expect(mock.calls.length).toBe(calls);
  });

  it('duyệt / từ chối / lưu thư viện / gắn sản phẩm / tải xuống', async () => {
    const [a, b] = itemIds as [string, string];
    const ok = await h
      .http()
      .post(`/images/items/${a}/approve`)
      .send({ note: 'Đúng màu, đúng hoa văn' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      approvalStatus: 'approved',
      reviewNote: 'Đúng màu, đúng hoa văn',
    });
    const rej = await h
      .http()
      .post(`/images/items/${b}/reject`)
      .send({ flags: ['color_mismatch', 'extra_items'] });
    expect(rej.body).toMatchObject({
      approvalStatus: 'rejected',
      reviewFlags: ['color_mismatch', 'extra_items'],
    });
    expect(
      (
        await h
          .http()
          .post(`/images/items/${b}/reject`)
          .send({ flags: ['khong-hop-le'] })
      ).status,
    ).toBe(422);
    expect((await h.http().post(`/images/items/${b}/save`)).status).toBe(409);
    expect((await h.http().post(`/images/items/${b}/link-product`)).status).toBe(409);

    const saved = await h.http().post(`/images/items/${a}/save`);
    expect(saved.body.savedToLibrary).toBe(true);
    const lib = await h.http().get('/media').query({ type: 'AI_IMAGE', pageSize: 100 });
    expect(lib.body.items.some((x: { id: string }) => x.id === saved.body.asset.id)).toBe(true);

    const linked = await h.http().post(`/images/items/${a}/link-product`);
    expect(linked.body.linkedToProduct).toBe(true);
    const product = await h.http().get(`/products/${products.bedding}`);
    const mediaIds = product.body.media.map((m: { mediaAssetId: string }) => m.mediaAssetId);
    expect(mediaIds).toEqual([refs.bedding, saved.body.asset.id]); // ảnh gốc vẫn là ảnh đại diện
    expect(product.body.media[0].isPrimary).toBe(true);

    const dl = await h.http().get(`/images/items/${a}/download-url`);
    const file = await fetch(dl.body.url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(file.headers.get('content-disposition')).toContain('attachment');
  });

  it('Video Factory: chế độ kiểm duyệt chặn ảnh chưa duyệt, nhận ảnh đã duyệt', async () => {
    const detail = await h.http().get(`/images/jobs/${jobId}`);
    const approved = detail.body.items.find(
      (i: { approvalStatus: string }) => i.approvalStatus === 'approved',
    ).asset.id;
    const pending = detail.body.items.find(
      (i: { approvalStatus: string }) => i.approvalStatus === 'pending',
    ).asset.id;
    const draft = (ids: string[]) => ({
      drafts: [
        {
          name: `${P} video`,
          batchKey: `${P}-batch`,
          productId: products.bedding,
          prompt: 'Video từ ảnh AI',
          config: {
            aspectRatio: '9:16',
            durationSec: 30,
            quality: '1080p',
            mode: 'image_slideshow',
            voiceId: 'v1',
            templateId: 't1',
          },
          mediaAssetIds: ids,
        },
      ],
    });
    const blocked = await h
      .http()
      .post('/drafts/video')
      .send(draft([approved, pending]));
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.message).toMatch(/chưa được duyệt/);
    const okRes = await h
      .http()
      .post('/drafts/video')
      .send(draft([refs.bedding, approved]));
    expect(okRes.status).toBe(201);
    expect(okRes.body[0].mediaAssetIds).toEqual([refs.bedding, approved]);
  });

  it('tạo lại: item MỚI trong cùng tác vụ, ảnh cũ giữ nguyên; bấm 2 lần -> 409', async () => {
    const src = itemIds[1]!;
    const before = await h.prisma.imageGenerationItem.findUnique({ where: { id: src } });
    const res = await h.http().post(`/images/items/${src}/regenerate`);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('QUEUED');
    const fresh = res.body.items.find(
      (i: { regeneratedFromId: string | null }) => i.regeneratedFromId === src,
    );
    expect(fresh).toMatchObject({ status: 'QUEUED', index: 3 });
    expect((await h.http().post(`/images/items/${src}/regenerate`)).status).toBe(409);
    expect(await processAll(jobId)).toEqual(['completed']);
    const after = await h.prisma.imageGenerationItem.findUnique({ where: { id: src } });
    expect(after?.mediaAssetId).toBe(before?.mediaAssetId);
    expect(after?.approvalStatus).toBe('rejected');
    expect((await h.http().get(`/images/jobs/${jobId}`)).body.counts.total).toBe(4);
  });
});

describe('Lỗi, retry, batch không hỏng toàn bộ', () => {
  it('1 lỗi tạm thời (thử lại thành công) + 1 từ chối + 1 thành công -> tác vụ COMPLETED, ghi lỗi chi tiết', async () => {
    const res = await h
      .http()
      .post('/images/jobs')
      .send(body({ count: 3, mode: 'batch_variations' }));
    const ids = res.body.items.map((i: { id: string }) => i.id) as string[];
    const ws = h.env.DEV_WORKSPACE_ID;
    const jobId = res.body.id;
    mock.setBehaviors([
      { kind: 'transient', times: 1 },
      { kind: 'ok' },
      { kind: 'refusal' },
      { kind: 'ok' },
    ]);
    expect(
      await processor.process(
        { workspaceId: ws, jobId, itemId: ids[0]! },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    ).toBe('retry');
    const mid = await h.prisma.imageGenerationItem.findUnique({ where: { id: ids[0] } });
    expect(mid).toMatchObject({ status: 'QUEUED', attempts: 1 });
    expect(mid?.errorMessage).toMatch(/thử lại/);
    expect(
      await processor.process(
        { workspaceId: ws, jobId, itemId: ids[0]! },
        { attemptsMade: 1, maxAttempts: 2 },
      ),
    ).toBe('completed');
    expect(
      await processor.process(
        { workspaceId: ws, jobId, itemId: ids[1]! },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    ).toBe('failed');
    expect(
      await processor.process(
        { workspaceId: ws, jobId, itemId: ids[2]! },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    ).toBe('completed');
    const d = await h.http().get(`/images/jobs/${jobId}`);
    expect(d.body.status).toBe('COMPLETED');
    expect(d.body.counts).toMatchObject({ completed: 2, failed: 1 });
    const failed = d.body.items.find((i: { status: string }) => i.status === 'FAILED');
    expect(failed.errorMessage).toMatch(/AI không trả về ảnh/);
    expect(failed.errorCode).toBe('provider_refusal');
    const usage = await h.prisma.aiUsage.findMany({
      where: { imageJobId: jobId },
      orderBy: { createdAt: 'asc' },
    });
    expect(usage.map((u) => u.status).sort()).toEqual(['failed', 'refused', 'success', 'success']);
    expect(
      usage.filter((u) => u.status !== 'success').every((u) => u.estimatedCostUsd === null),
    ).toBe(true);
  });

  it('lỗi tạm thời hết số lần thử -> FAILED (không gọi vô hạn)', async () => {
    const res = await h.http().post('/images/jobs').send(body());
    const it0 = res.body.items[0].id;
    mock.setBehaviors([{ kind: 'transient', times: 5 }]);
    const ws = h.env.DEV_WORKSPACE_ID;
    expect(
      await processor.process(
        { workspaceId: ws, jobId: res.body.id, itemId: it0 },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    ).toBe('retry');
    expect(
      await processor.process(
        { workspaceId: ws, jobId: res.body.id, itemId: it0 },
        { attemptsMade: 1, maxAttempts: 2 },
      ),
    ).toBe('failed');
    // Lần chạy thứ 3 (vd khôi phục nhầm) bị chặn bởi bộ đếm attempts trong DB
    await h.prisma.imageGenerationItem.update({ where: { id: it0 }, data: { status: 'QUEUED' } });
    const calls = mock.calls.length;
    expect(
      await processor.process(
        { workspaceId: ws, jobId: res.body.id, itemId: it0 },
        { attemptsMade: 0, maxAttempts: 2 },
      ),
    ).toBe('failed');
    expect(mock.calls.length).toBe(calls);
    mock.setBehaviors([]);
  });

  it('provider trả dữ liệu hỏng -> FAILED, KHÔNG tạo MediaAsset, KHÔNG để object mồ côi', async () => {
    const res = await h.http().post('/images/jobs').send(body());
    const itemId = res.body.items[0].id;
    mock.setBehaviors([{ kind: 'corrupt' }]);
    expect(await processAll(res.body.id)).toEqual(['failed']);
    const item = await h.prisma.imageGenerationItem.findUnique({ where: { id: itemId } });
    expect(item?.mediaAssetId).toBeNull();
    const objects = await storage.listObjects(`ws/${h.env.DEV_WORKSPACE_ID}/ai-images/`);
    expect(objects.some((o) => o.key.includes(itemId))).toBe(false);
  });

  it('provider trả sai tỷ lệ -> PAD (công khai), không kéo méo', async () => {
    const res = await h.http().post('/images/jobs').send(body());
    mock.setBehaviors([{ kind: 'square' }]);
    expect(await processAll(res.body.id)).toEqual(['completed']);
    const it = (await h.http().get(`/images/jobs/${res.body.id}`)).body.items[0];
    expect(it.autoCheck.fit).toMatchObject({
      mode: 'pad',
      providerWidth: 1080,
      providerHeight: 1080,
      finalWidth: 1080,
      finalHeight: 1920,
    });
    expect(it.autoCheck.flags).toContain('aspect_padded');
    expect(it.autoCheck.notes.join(' ')).toMatch(/THÊM VIỀN/);
  });

  it('huỷ tác vụ: item chưa chạy bị huỷ, worker bỏ qua (không gọi provider)', async () => {
    const res = await h
      .http()
      .post('/images/jobs')
      .send(body({ count: 3, mode: 'batch_variations' }));
    const cancel = await h.http().post(`/images/jobs/${res.body.id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.status).toBe('CANCELLED');
    expect(cancel.body.items.every((i: { status: string }) => i.status === 'CANCELLED')).toBe(true);
    const calls = mock.calls.length;
    const r = await processor.process(
      { workspaceId: h.env.DEV_WORKSPACE_ID, jobId: res.body.id, itemId: res.body.items[0].id },
      { attemptsMade: 0, maxAttempts: 2 },
    );
    expect(r).toBe('skipped');
    expect(mock.calls.length).toBe(calls);
    expect((await h.http().post(`/images/jobs/${res.body.id}/cancel`)).status).toBe(409);
  });
});

describe('Xoá tác vụ', () => {
  it('đang chạy -> 409; đã xong -> xoá ảnh chưa lưu khỏi MinIO, giữ ảnh đã lưu thư viện & ảnh gốc', async () => {
    const res = await h
      .http()
      .post('/images/jobs')
      .send(body({ count: 3, mode: 'batch_variations' }));
    expect((await h.http().delete(`/images/jobs/${res.body.id}`)).status).toBe(409);
    await processAll(res.body.id);
    const items = (await h.http().get(`/images/jobs/${res.body.id}`)).body.items as Array<{
      id: string;
      asset: { id: string };
    }>;
    await h.http().post(`/images/items/${items[0]!.id}/save`);
    const keys = await h.prisma.mediaAsset.findMany({
      where: { id: { in: items.map((i) => i.asset.id) } },
      select: { id: true, storageKey: true },
    });
    const del = await h.http().delete(`/images/jobs/${res.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ deleted: true, removedImages: 2, keptImages: 1 });
    expect((await h.http().get(`/images/jobs/${res.body.id}`)).status).toBe(404);
    const kept = keys.find((k) => k.id === items[0]!.asset.id)!;
    expect(await storage.head(kept.storageKey)).not.toBeNull();
    for (const k of keys.filter((x) => x.id !== kept.id)) {
      expect(await storage.head(k.storageKey)).toBeNull();
      expect(await h.prisma.mediaAsset.findUnique({ where: { id: k.id } })).toBeNull();
    }
    expect(await h.prisma.mediaAsset.findUnique({ where: { id: refs.bedding } })).not.toBeNull();
    await h.http().delete(`/media/${kept.id}?force=true`);
  });
});

describe('Mode F – ghép ảnh gốc (không AI)', () => {
  it('tạo ảnh COMPOSED_IMAGE, không ghi ai_usage, chỉ 1 ảnh/lần', async () => {
    const bad = await h
      .http()
      .post('/images/jobs')
      .send(body({ mode: 'original_composition', templateId: 'clean_studio', count: 3 }));
    expect(bad.status).toBe(422);
    const wrongTpl = await h
      .http()
      .post('/images/jobs')
      .send(body({ mode: 'original_composition', templateId: 'luxury_bedroom' }));
    expect(wrongTpl.status).toBe(422);
    const res = await h
      .http()
      .post('/images/jobs')
      .send(
        body({
          mode: 'original_composition',
          templateId: 'clean_studio',
          aspect: '1:1',
          backgroundColor: '#EEEEEE',
          provider: undefined,
        }),
      );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ usesAi: false, provider: 'composition', isMock: false });
    expect(res.body.items[0].prompt).toBeNull();
    const calls = mock.calls.length;
    expect(await processAll(res.body.id)).toEqual(['completed']);
    expect(mock.calls.length).toBe(calls);
    const it = (await h.http().get(`/images/jobs/${res.body.id}`)).body.items[0];
    expect(it.asset).toMatchObject({ assetType: 'COMPOSED_IMAGE', width: 1080, height: 1080 });
    expect(await h.prisma.aiUsage.count({ where: { imageJobId: res.body.id } })).toBe(0);
  });
});

describe('Cô lập workspace & kiểm tra đầu vào', () => {
  it('tác vụ của workspace khác -> 404; ảnh không thuộc sản phẩm -> 422; client gửi workspaceId -> 422', async () => {
    await h.prisma.workspace.create({
      data: { id: OTHER_WS, name: 'Khác', slug: `other-img-${RUN.toLowerCase()}` },
    });
    const foreign = await h.prisma.imageGenerationJob.create({
      data: {
        workspaceId: OTHER_WS,
        productName: 'X',
        idempotencyKey: randomUUID(),
        mode: 'lifestyle_interior',
        templateId: 'luxury_bedroom',
        templateVersion: '1.0.0',
        aspect: '9:16',
        requestedCount: 1,
        provider: 'mock',
        model: 'mock-image-v1',
        referenceAssetIds: [],
        visualContext: {},
        items: { create: [{ workspaceId: OTHER_WS, index: 0, variationIndex: 0 }] },
      },
      include: { items: true },
    });
    expect((await h.http().get(`/images/jobs/${foreign.id}`)).status).toBe(404);
    expect((await h.http().post(`/images/jobs/${foreign.id}/cancel`)).status).toBe(404);
    expect((await h.http().post(`/images/items/${foreign.items[0]!.id}/approve`)).status).toBe(404);
    const list = await h.http().get('/images/jobs').query({ pageSize: 100 });
    expect(list.body.items.some((j: { id: string }) => j.id === foreign.id)).toBe(false);

    // Ảnh của sản phẩm khác làm tham chiếu
    const wrongRef = await h
      .http()
      .post('/images/jobs')
      .send(body({ referenceAssetIds: [refs.rug] }));
    expect(wrongRef.status).toBe(422);
    const ws = await h
      .http()
      .post('/images/jobs')
      .send({ ...body(), workspaceId: OTHER_WS });
    expect(ws.status).toBe(422);
    // Template thảm cho bộ chăn ga -> 422
    const tpl = await h
      .http()
      .post('/images/jobs')
      .send(body({ templateId: 'modern_living_room_rug' }));
    expect(tpl.status).toBe(422);
  });
});

describe('Hàng đợi BullMQ thật + khôi phục sau restart', () => {
  it('đưa vào hàng đợi không trùng; mất job + item RUNNING (tiến trình chết) -> reconcile đưa lại; worker hoàn tất', async () => {
    const res = await h.http().post('/images/jobs').send(body());
    expect(res.status).toBe(201);
    const itemId = res.body.items[0].id;
    const qid = imageQueueJobId(itemId);
    const job = await queue.queue.getJob(qid);
    expect(job).toBeTruthy();
    expect(await job!.getState()).toBe('waiting');
    // Thêm lại -> không tạo job trùng
    await queue.enqueue([{ workspaceId: h.env.DEV_WORKSPACE_ID, jobId: res.body.id, itemId }]);
    const waiting = await queue.queue.getJobs(['waiting']);
    expect(waiting.filter((j) => j.id === qid)).toHaveLength(1);

    // Giả lập tiến trình chết giữa chừng: item RUNNING trong DB, job Redis bị mất
    await h.prisma.imageGenerationItem.update({
      where: { id: itemId },
      data: { status: 'RUNNING', stage: 'calling_provider' },
    });
    await job!.remove();
    expect(await queue.reconcile()).toBeGreaterThanOrEqual(1);
    const restored = await h.prisma.imageGenerationItem.findUnique({ where: { id: itemId } });
    expect(restored).toMatchObject({ status: 'QUEUED', stage: 'queued' });
    expect(await (await queue.queue.getJob(qid))!.getState()).toBe('waiting');

    // Worker BullMQ thật xử lý
    queue.startWorker();
    const deadline = Date.now() + 25_000;
    let status = 'QUEUED';
    while (Date.now() < deadline) {
      status = (await h.prisma.imageGenerationItem.findUnique({ where: { id: itemId } }))!.status;
      if (status === 'COMPLETED' || status === 'FAILED') break;
      await new Promise((r) => setTimeout(r, 300));
    }
    await queue.stopWorker();
    expect(status).toBe('COMPLETED');
    expect((await h.http().get(`/images/jobs/${res.body.id}`)).body.status).toBe('COMPLETED');
  });
});
