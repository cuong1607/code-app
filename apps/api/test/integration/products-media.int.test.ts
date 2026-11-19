import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JPEG_1X1, WEBP_1X1, uniquePng } from '../fixtures/images';
import { type Harness, startApp, uploadImage } from './app-harness';

const RUN = Date.now().toString(36).toUpperCase();
const SKU = (n: string) => `IT${RUN}-${n}`;

let h: Harness;
const mediaIds: string[] = [];

beforeAll(async () => {
  h = await startApp();
});

afterAll(async () => {
  // Dọn dữ liệu kiểm thử (sản phẩm + ảnh + file trên MinIO)
  await h.prisma.product.deleteMany({ where: { sku: { startsWith: `IT${RUN}` } } });
  for (const id of mediaIds) await h.http().delete(`/media/${id}?force=true`);
  await h.app.close();
});

describe('Product API', () => {
  let id: string;

  it('tạo sản phẩm: chuẩn hoá SKU, tiền dạng Decimal chuỗi', async () => {
    const res = await h
      .http()
      .post('/products')
      .send({
        sku: SKU('a1').toLowerCase(),
        name: 'Áo khoác gió Đỏ Đô',
        category: 'Thời trang',
        brand: 'Hãng Thử',
        costPrice: 120000.5,
        sellingPrice: 259000,
        attributes: { 'Màu sắc': 'Đỏ' },
        status: 'active',
      });
    expect(res.status).toBe(201);
    expect(res.body.sku).toBe(SKU('A1'));
    expect(res.body.sellingPrice).toBe('259000.00');
    expect(res.body.costPrice).toBe('120000.50');
    expect(res.body.currency).toBe('VND');
    id = res.body.id;
  });

  it('SKU trùng (khác hoa/thường) -> 409 CONFLICT', async () => {
    const res = await h
      .http()
      .post('/products')
      .send({ sku: SKU('A1').toLowerCase(), name: 'Trùng', category: 'X', sellingPrice: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('đã tồn tại');
  });

  it('dữ liệu sai -> 422 với lỗi tiếng Việt từng trường', async () => {
    const res = await h.http().post('/products').send({ sku: 'x', name: 'A', sellingPrice: -5 });
    expect(res.status).toBe(422);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['sku', 'name', 'category', 'sellingPrice']));
  });

  it('tìm kiếm tiếng Việt không dấu + lọc + phân trang', async () => {
    for (const n of ['b1', 'b2', 'b3']) {
      await h
        .http()
        .post('/products')
        .send({
          sku: SKU(n),
          name: `Đèn ngủ gốm ${n}`,
          category: 'Nội thất IT',
          sellingPrice: 100000,
        });
    }
    const search = await h
      .http()
      .get('/products')
      .query({ search: 'den ngu gom', category: 'Nội thất IT' });
    expect(search.body.total).toBe(3);
    const accent = await h.http().get('/products').query({ search: 'áo khoác gió đỏ' });
    expect(accent.body.items.map((p: { id: string }) => p.id)).toContain(id);
    const page2 = await h
      .http()
      .get('/products')
      .query({ category: 'Nội thất IT', pageSize: 2, page: 2, sortBy: 'sku', sortDir: 'asc' });
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].sku).toBe(SKU('B3'));
  });

  it('cập nhật từng phần không ghi đè trường khác', async () => {
    const res = await h.http().patch(`/products/${id}`).send({ name: 'Áo khoác gió (mới)' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Áo khoác gió (mới)');
    expect(res.body.brand).toBe('Hãng Thử');
    expect(res.body.attributes).toEqual({ 'Màu sắc': 'Đỏ' });
  });

  it('id sai định dạng -> 422; không tồn tại -> 404', async () => {
    expect((await h.http().get('/products/abc')).status).toBe(422);
    expect((await h.http().get('/products/00000000-0000-4000-8000-00000000ffff')).status).toBe(404);
  });

  it('xoá sản phẩm', async () => {
    const created = await h
      .http()
      .post('/products')
      .send({ sku: SKU('del'), name: 'Sẽ xoá', category: 'X', sellingPrice: 1 });
    expect((await h.http().delete(`/products/${created.body.id}`)).status).toBe(200);
    expect((await h.http().get(`/products/${created.body.id}`)).status).toBe(404);
  });
});

describe('Media upload (presigned) + ảnh sản phẩm', () => {
  let productId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    const p = await h
      .http()
      .post('/products')
      .send({ sku: SKU('m1'), name: 'Sản phẩm ảnh', category: 'X', sellingPrice: 1 });
    productId = p.body.id;
  });

  it('upload 1 ảnh PNG: server xác minh và lưu metadata', async () => {
    const { complete } = await uploadImage(h, {
      name: 'ảnh chính.png',
      type: 'image/png',
      body: uniquePng(1),
    });
    expect(complete?.status).toBe(200);
    const asset = complete!.body.asset;
    expect(asset).toMatchObject({
      mimeType: 'image/png',
      width: 1,
      height: 1,
      assetType: 'ORIGINAL_IMAGE',
      filename: 'ảnh chính.png',
    });
    expect(complete!.body.duplicate).toBe(false);
    ids.push(asset.id);
    mediaIds.push(asset.id);
  });

  it('upload nhiều ảnh (JPEG + WebP)', async () => {
    for (const f of [
      { name: 'b.jpg', type: 'image/jpeg', body: JPEG_1X1 },
      { name: 'c.webp', type: 'image/webp', body: WEBP_1X1 },
    ]) {
      const { complete } = await uploadImage(h, f);
      expect(complete?.status).toBe(200);
      ids.push(complete!.body.asset.id);
      mediaIds.push(complete!.body.asset.id);
    }
  });

  it('file trùng nội dung -> trả tài nguyên cũ, không tạo bản ghi mới', async () => {
    const { complete } = await uploadImage(h, {
      name: 'copy.jpg',
      type: 'image/jpeg',
      body: JPEG_1X1,
    });
    expect(complete!.body.duplicate).toBe(true);
    expect(complete!.body.asset.id).toBe(ids[1]);
  });

  it('sai định dạng khai báo (gif) -> 422 ngay ở bước xin URL', async () => {
    const res = await h
      .http()
      .post('/media/uploads')
      .send({ filename: 'a.gif', contentType: 'image/gif', size: 10 });
    expect(res.status).toBe(422);
  });

  it('file giả mạo (text khai báo là png) -> 422 khi xác minh, object bị xoá', async () => {
    const { ticket, complete } = await uploadImage(h, {
      name: 'gia.png',
      type: 'image/png',
      body: Buffer.from('không phải ảnh'),
    });
    expect(complete?.status).toBe(422);
    const upload = await h.prisma.mediaUpload.findUnique({ where: { id: ticket.body.uploadId } });
    expect(upload?.status).toBe('failed');
  });

  it('vượt dung lượng -> 422 (khai báo) và dung lượng thật khác khai báo -> 422', async () => {
    const big = await h
      .http()
      .post('/media/uploads')
      .send({ filename: 'x.png', contentType: 'image/png', size: 50 * 1024 * 1024 });
    expect(big.status).toBe(422);
    const { complete } = await uploadImage(h, {
      name: 'y.png',
      type: 'image/png',
      body: uniquePng(9),
      declaredSize: 10,
    });
    expect(complete?.status).toBe(422);
  });

  it('gắn ảnh vào sản phẩm: ảnh đầu tiên tự là ảnh đại diện', async () => {
    const res = await h.http().post(`/products/${productId}/media`).send({ mediaAssetIds: ids });
    expect(res.status).toBe(201);
    expect(res.body.imageCount).toBe(3);
    expect(res.body.media.map((m: { isPrimary: boolean }) => m.isPrimary)).toEqual([
      true,
      false,
      false,
    ]);
    expect(res.body.primaryImage.id).toBe(ids[0]);
  });

  it('đổi ảnh đại diện, sắp xếp lại, gỡ ảnh đại diện -> ảnh kế tiếp thành đại diện', async () => {
    let res = await h.http().put(`/products/${productId}/media/${ids[2]}/primary`);
    expect(res.body.primaryImage.id).toBe(ids[2]);
    res = await h
      .http()
      .put(`/products/${productId}/media/order`)
      .send({ mediaAssetIds: [ids[2], ids[0], ids[1]] });
    expect(res.body.media.map((m: { mediaAssetId: string }) => m.mediaAssetId)).toEqual([
      ids[2],
      ids[0],
      ids[1],
    ]);
    const bad = await h
      .http()
      .put(`/products/${productId}/media/order`)
      .send({ mediaAssetIds: [ids[0]] });
    expect(bad.status).toBe(422);
    res = await h.http().delete(`/products/${productId}/media/${ids[2]}`);
    expect(res.body.imageCount).toBe(2);
    expect(res.body.primaryImage.id).toBe(ids[0]);
  });

  it('URL xem trước và tải xuống trả đúng nội dung file', async () => {
    const asset = await h.http().get(`/media/${ids[1]}`);
    const preview = await fetch(asset.body.previewUrl);
    expect(preview.status).toBe(200);
    const dl = await h.http().get(`/media/${ids[1]}/download-url`);
    const file = await fetch(dl.body.url);
    expect(file.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await file.arrayBuffer()).equals(Buffer.from(JPEG_1X1))).toBe(true);
  });

  it('thư viện: lọc theo loại + tìm kiếm', async () => {
    const res = await h.http().get('/media').query({ type: 'ORIGINAL_IMAGE', search: 'anh chinh' });
    expect(res.body.items.map((m: { id: string }) => m.id)).toContain(ids[0]);
  });

  it('xoá ảnh đang dùng -> 409; xác nhận force -> xoá và gỡ liên kết', async () => {
    const conflict = await h.http().delete(`/media/${ids[0]}`);
    expect(conflict.status).toBe(409);
    const ok = await h.http().delete(`/media/${ids[0]}?force=true`);
    expect(ok.body.unlinkedProducts).toBe(1);
    const p = await h.http().get(`/products/${productId}`);
    expect(p.body.imageCount).toBe(1);
    expect(p.body.primaryImage.id).toBe(ids[1]);
  });

  it('dọn dẹp: phiên upload hết hạn bị đánh dấu expired', async () => {
    const t = await h
      .http()
      .post('/media/uploads')
      .send({ filename: 'z.png', contentType: 'image/png', size: 100 });
    await h.prisma.mediaUpload.update({
      where: { id: t.body.uploadId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const r = await h.http().post('/media/maintenance/cleanup');
    expect(r.body.expiredUploads).toBeGreaterThanOrEqual(1);
    const up = await h.prisma.mediaUpload.findUnique({ where: { id: t.body.uploadId } });
    expect(up?.status).toBe('expired');
  });
});
