import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeXlsx } from '../../src/imports/spreadsheet';
import { type Harness, startApp } from './app-harness';

const RUN = Date.now().toString(36).toUpperCase();
const P = `IM${RUN}`;
let h: Harness;

beforeAll(async () => {
  h = await startApp();
});

afterAll(async () => {
  await h.prisma.product.deleteMany({ where: { sku: { startsWith: P } } });
  await h.prisma.videoDraft.deleteMany({ where: { batchKey: { startsWith: P } } });
  await h.prisma.promptPreset.deleteMany({ where: { name: { startsWith: P } } });
  await h.app.close();
});

const HEADER = 'SKU,Tên sản phẩm,Danh mục,Giá bán,Màu sắc,URL hình ảnh\n';

describe('Import CSV/XLSX', () => {
  it('CSV: preview -> mapping gợi ý -> validate báo lỗi từng dòng -> commit', async () => {
    const csv =
      HEADER +
      `${P}-1,Áo sơ mi,Thời trang,199.000,Trắng,https://cdn.test/a.jpg\n` +
      `${P}-2,Quần tây,Thời trang,abc,,\n` + // giá sai
      `${P}-1,Trùng trong file,Thời trang,1000,,\n` + // trùng SKU trong file
      `${P}-3,Mũ lưỡi trai,Phụ kiện,"150,000",Đen,\n`;
    const preview = await h
      .http()
      .post('/products/import/preview')
      .attach('file', Buffer.from(csv), 'sản phẩm.csv');
    expect(preview.status).toBe(200);
    expect(preview.body.fileName).toBe('sản phẩm.csv');
    expect(preview.body.suggestedMapping).toMatchObject({
      sku: 0,
      name: 1,
      category: 2,
      sellingPrice: 3,
      color: 4,
      imageUrls: 5,
    });

    const req = {
      format: 'csv',
      headers: preview.body.headers,
      rows: preview.body.rows,
      mapping: preview.body.suggestedMapping,
      mode: 'skip_duplicates',
    };
    const validate = await h.http().post('/products/import/validate').send(req);
    expect(validate.body.committed).toBe(false);
    expect(validate.body.summary).toMatchObject({ total: 4, created: 2, failed: 2 });
    expect(validate.body.rows[1].errors.join()).toContain('Giá bán "abc"');
    expect(validate.body.rows[2].errors.join()).toContain('trùng với dòng 2');
    expect(await h.prisma.product.count({ where: { sku: { startsWith: P } } })).toBe(0); // validate KHÔNG ghi

    const commit = await h.http().post('/products/import/commit').send(req);
    expect(commit.body.committed).toBe(true);
    expect(commit.body.summary.created).toBe(2);
    const p1 = await h.prisma.product.findFirst({ where: { sku: `${P}-1` } });
    expect(p1?.sourceType).toBe('import_csv');
    expect(Number(p1?.sellingPrice)).toBe(199000);
    expect(p1?.pendingImageUrls).toEqual(['https://cdn.test/a.jpg']); // ghi nhận, CHƯA tải
    expect(p1?.attributes).toEqual({ 'Màu sắc': 'Trắng' });
  });

  it('SKU đã tồn tại: bỏ qua / cập nhật / chỉ nhập mới (dừng toàn bộ)', async () => {
    const rows = [
      [`${P}-1`, 'Áo sơ mi (cập nhật)', 'Thời trang', '210000', '', ''],
      [`${P}-9`, 'Sản phẩm mới', 'Khác', '5000', '', ''],
    ];
    const base = {
      format: 'csv',
      headers: HEADER.trim().split(','),
      rows,
      mapping: { sku: 0, name: 1, category: 2, sellingPrice: 3, color: 4, imageUrls: 5 },
    };

    const onlyNew = await h
      .http()
      .post('/products/import/commit')
      .send({ ...base, mode: 'only_new' });
    expect(onlyNew.body.committed).toBe(false);
    expect(onlyNew.body.abortedReason).toContain('Chỉ nhập sản phẩm mới');
    expect(await h.prisma.product.count({ where: { sku: `${P}-9` } })).toBe(0);

    const skip = await h
      .http()
      .post('/products/import/validate')
      .send({ ...base, mode: 'skip_duplicates' });
    expect(skip.body.rows.map((r: { action: string }) => r.action)).toEqual(['skip', 'create']);

    const update = await h
      .http()
      .post('/products/import/commit')
      .send({ ...base, mode: 'update_duplicates' });
    expect(update.body.summary).toMatchObject({ updated: 1, created: 1 });
    const p1 = await h.prisma.product.findFirst({ where: { sku: `${P}-1` } });
    expect(p1?.name).toBe('Áo sơ mi (cập nhật)');
    expect(Number(p1?.sellingPrice)).toBe(210000);
    expect(p1?.attributes).toEqual({ 'Màu sắc': 'Trắng' }); // cột màu trống -> giữ giá trị cũ
    expect(p1?.pendingImageUrls).toEqual(['https://cdn.test/a.jpg']);
  });

  it('XLSX hợp lệ + thiếu cột bắt buộc', async () => {
    const xlsx = await writeXlsx(
      ['Mã SP', 'Tên', 'Danh mục', 'Giá bán (VND)'],
      [[`${P}-X1`, 'Bình hoa', 'Nội thất', 350000]],
      'Sheet1',
    );
    const preview = await h.http().post('/products/import/preview').attach('file', xlsx, 'a.xlsx');
    expect(preview.body.format).toBe('xlsx');
    const req = {
      format: 'xlsx',
      headers: preview.body.headers,
      rows: preview.body.rows,
      mapping: preview.body.suggestedMapping,
      mode: 'skip_duplicates',
    };
    const commit = await h.http().post('/products/import/commit').send(req);
    expect(commit.body.summary.created).toBe(1);
    expect((await h.prisma.product.findFirst({ where: { sku: `${P}-X1` } }))?.sourceType).toBe(
      'import_xlsx',
    );

    const missing = await h
      .http()
      .post('/products/import/validate')
      .send({ ...req, mapping: { sku: 0 } });
    expect(missing.status).toBe(422);
    expect(missing.body.error.message).toContain('Tên sản phẩm');
  });

  it('file sai định dạng -> 422', async () => {
    const res = await h
      .http()
      .post('/products/import/preview')
      .attach('file', Buffer.from('%PDF'), 'a.pdf');
    expect(res.status).toBe(422);
  });

  it('xuất CSV/XLSX + tải file mẫu', async () => {
    const csv = await h
      .http()
      .get('/products/export')
      .query({ format: 'csv', search: P })
      .buffer(true);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain(`${P}-1`);
    const tpl = await h
      .http()
      .get('/products/import/template')
      .query({ format: 'xlsx' })
      .buffer(true);
    expect(tpl.status).toBe(200);
    expect(tpl.headers['content-disposition']).toContain('mau-import-san-pham.xlsx');
  });
});

describe('Bản nháp & cài đặt', () => {
  it('Video Factory: tạo nhiều luồng, sửa, xoá; sản phẩm phải thuộc workspace', async () => {
    const product = await h.prisma.product.findFirst({ where: { sku: `${P}-1` } });
    const draft = {
      name: `${P} luồng`,
      batchKey: `${P}-batch`,
      productId: product!.id,
      prompt: 'Video {duration} giây',
      config: {
        aspectRatio: '9:16',
        durationSec: 30,
        quality: '1080p',
        mode: 'image_slideshow',
        voiceId: 'v1',
        templateId: 't1',
      },
      mediaAssetIds: [],
    };
    const created = await h
      .http()
      .post('/drafts/video')
      .send({ drafts: [draft, { ...draft, name: `${P} luồng 2` }] });
    expect(created.status).toBe(201);
    expect(created.body).toHaveLength(2);
    expect(created.body[0].productName).toBe('Áo sơ mi (cập nhật)');
    const patched = await h
      .http()
      .patch(`/drafts/video/${created.body[0].id}`)
      .send({ prompt: 'Mới' });
    expect(patched.body.prompt).toBe('Mới');
    const bad = await h
      .http()
      .post('/drafts/video')
      .send({ drafts: [{ ...draft, productId: '00000000-0000-4000-8000-00000000ffff' }] });
    expect(bad.status).toBe(404);

    const post = await h
      .http()
      .post('/drafts/publishing')
      .send({
        drafts: [
          {
            videoDraftId: created.body[0].id,
            accountRef: null,
            caption: 'Xin chào',
            hashtags: ['#a'],
            mode: 'scheduled',
            scheduledAt: '2030-01-15T01:00:00.000Z',
          },
        ],
      });
    expect(post.body[0]).toMatchObject({ videoName: `${P} luồng`, status: 'pending_review' });
    const del = await h
      .http()
      .post('/drafts/video/delete')
      .send({ ids: created.body.map((d: { id: string }) => d.id) });
    expect(del.body.deleted).toBe(2);
    // Xoá luồng video -> bài đăng nháp vẫn còn (video_draft_id = NULL)
    const posts = await h.http().get('/drafts/publishing');
    const kept = posts.body.find((p: { id: string }) => p.id === post.body[0].id);
    expect(kept.videoDraftId).toBeNull();
    await h.http().delete(`/drafts/publishing/${kept.id}`);
  });

  it('prompt đã lưu: trùng tên -> 409', async () => {
    const body = { scope: 'video', name: `${P} prompt`, content: 'Nội dung' };
    expect((await h.http().post('/prompt-presets').send(body)).status).toBe(201);
    expect((await h.http().post('/prompt-presets').send(body)).status).toBe(409);
  });

  it('cài đặt: lưu từng nhóm không reset nhóm khác; từ chối khoá lạ (API key)', async () => {
    const before = await h.http().get('/settings');
    await h
      .http()
      .put('/settings')
      .send({ preferences: { cost: { monthlyBudgetUsd: 77 } } });
    const after = await h.http().get('/settings');
    expect(after.body.preferences.cost.monthlyBudgetUsd).toBe(77);
    expect(after.body.preferences.batch).toEqual(before.body.preferences.batch);
    const leak = await h
      .http()
      .put('/settings')
      .send({ preferences: { openaiApiKey: 'sk-test' } });
    expect(leak.status).toBe(422);
    await h
      .http()
      .put('/settings')
      .send({ preferences: { cost: before.body.preferences.cost } });
  });

  it('dashboard: số liệu thật', async () => {
    const res = await h.http().get('/dashboard/summary');
    expect(res.body.productCount).toBeGreaterThan(0);
    expect(res.body.productsPerDay).toHaveLength(14);
    expect(res.body.videoCount).toBe(0);
  });
});
