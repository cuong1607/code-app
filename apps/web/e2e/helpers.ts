import { type APIRequestContext, request } from '@playwright/test';

/** API NestJS thật (dev-local, loopback). */
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';

export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** PNG hợp lệ có nội dung khác nhau (thêm chunk tEXt) để không bị coi là file trùng. */
export function uniquePng(tag: string): Buffer {
  const text = Buffer.from(`Comment\0${tag}-${Date.now()}-${Math.random()}`, 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(text.length);
  const iend = PNG_1X1.length - 12;
  return Buffer.concat([
    PNG_1X1.subarray(0, iend),
    len,
    Buffer.from('tEXt'),
    text,
    Buffer.alloc(4),
    PNG_1X1.subarray(iend),
  ]);
}

export const runPrefix = () =>
  `E2E${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000)}`;

export async function api(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: API_URL });
}

/** Dọn dữ liệu kiểm thử theo tiền tố SKU / tên. */
export async function cleanup(prefix: string) {
  const ctx = await api();
  try {
    const products = await (
      await ctx.get('/products', { params: { search: prefix, pageSize: 100 } })
    ).json();
    for (const p of products.items ?? []) {
      const detail = await (await ctx.get(`/products/${p.id}`)).json();
      await ctx.delete(`/products/${p.id}`);
      for (const m of detail.media ?? []) await ctx.delete(`/media/${m.mediaAssetId}?force=true`);
    }
    const media = await (
      await ctx.get('/media', { params: { search: prefix.toLowerCase(), pageSize: 100 } })
    ).json();
    for (const m of media.items ?? []) await ctx.delete(`/media/${m.id}?force=true`);
    const videos = (await (await ctx.get('/drafts/video')).json()) as {
      id: string;
      name: string;
    }[];
    const vIds = videos.filter((v) => v.name.includes(prefix)).map((v) => v.id);
    const posts = (await (await ctx.get('/drafts/publishing')).json()) as {
      id: string;
      videoName: string;
      caption: string;
    }[];
    const pIds = posts
      .filter((p) => p.videoName.includes(prefix) || p.caption.includes(prefix))
      .map((p) => p.id);
    if (pIds.length) await ctx.post('/drafts/publishing/delete', { data: { ids: pIds } });
    if (vIds.length) await ctx.post('/drafts/video/delete', { data: { ids: vIds } });
  } finally {
    await ctx.dispose();
  }
}

export async function createProduct(prefix: string, suffix: string, name: string) {
  const ctx = await api();
  const res = await ctx.post('/products', {
    data: {
      sku: `${prefix}-${suffix}`,
      name,
      category: 'Kiểm thử E2E',
      sellingPrice: 150000,
      status: 'active',
    },
  });
  const body = await res.json();
  await ctx.dispose();
  if (!res.ok()) throw new Error(`Tạo sản phẩm thất bại: ${JSON.stringify(body)}`);
  return body as { id: string; sku: string; name: string };
}
