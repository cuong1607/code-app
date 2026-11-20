import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AppError } from '@acs/shared';
import {
  compareColors,
  composeOnBackground,
  deltaE,
  fitToAspect,
  inspectOutput,
  normalizeReference,
} from './image-processing';

const solid = (color: string, w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .png()
    .toBuffer();

/** Ảnh "sản phẩm": nền trắng (phông chụp) + khối màu ở giữa. */
async function productPhoto(productColor: string, w = 200, h = 200) {
  const inner = await solid(productColor, Math.round(w * 0.6), Math.round(h * 0.6));
  return sharp({ create: { width: w, height: h, channels: 3, background: '#FFFFFF' } })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toBuffer();
}

describe('fitToAspect – không kéo méo, công khai cách pad', () => {
  it('đúng tỷ lệ (trong dung sai) -> giữ nguyên', async () => {
    const img = await solid('#123456', 768, 1376); // Gemini 9:16 1K
    const r = await fitToAspect(img, '9:16');
    expect(r.fit.mode).toBe('none');
    expect(r.data.equals(img)).toBe(true);
  });

  it('sai tỷ lệ -> pad đều 2 bên, ảnh gốc giữ nguyên kích thước (không scale)', async () => {
    const img = await solid('#AA0000', 1000, 1000);
    const r = await fitToAspect(img, '9:16');
    expect(r.fit).toMatchObject({
      mode: 'pad',
      providerWidth: 1000,
      providerHeight: 1000,
      finalWidth: 1000,
    });
    expect(r.fit.finalHeight).toBe(Math.round(1000 / (9 / 16)));
    const meta = await sharp(r.data).metadata();
    expect(meta.width! / meta.height!).toBeCloseTo(9 / 16, 3);
    // Điểm ảnh trung tâm vẫn là màu gốc
    const { data } = await sharp(r.data)
      .extract({ left: 500, top: Math.round(meta.height! / 2), width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([170, 0, 0]);
  });

  it('ảnh rộng -> pad trên/dưới cho 1:1', async () => {
    const r = await fitToAspect(await solid('#00AA00', 1600, 900), '1:1');
    expect(r.fit).toMatchObject({ mode: 'pad', finalWidth: 1600, finalHeight: 1600 });
  });
});

describe('inspectOutput – không tin dữ liệu provider', () => {
  it('từ chối dữ liệu không phải ảnh / rỗng', async () => {
    await expect(inspectOutput(Buffer.from('hello'))).rejects.toBeInstanceOf(AppError);
    await expect(inspectOutput(Buffer.alloc(0))).rejects.toBeInstanceOf(AppError);
    // Magic bytes PNG nhưng nội dung hỏng
    const fake = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(20),
    ]);
    await expect(inspectOutput(fake)).rejects.toBeInstanceOf(AppError);
  });
  it('đọc kích thước ảnh thật', async () => {
    expect(await inspectOutput(await solid('#000000', 30, 40))).toMatchObject({
      width: 30,
      height: 40,
      mimeType: 'image/png',
    });
  });
});

describe('compareColors – chỉ số tham khảo', () => {
  it('ảnh mới giữ màu sản phẩm -> coverage cao; đổi màu -> coverage thấp', async () => {
    const ref = await productPhoto('#1E4DB7'); // xanh dương
    const sameColorScene = await sharp({
      create: { width: 300, height: 500, channels: 3, background: '#D9CBB5' },
    })
      .composite([{ input: await solid('#1E4DB7', 150, 150), gravity: 'center' }])
      .png()
      .toBuffer();
    const recolored = await sharp({
      create: { width: 300, height: 500, channels: 3, background: '#D9CBB5' },
    })
      .composite([{ input: await solid('#C0392B', 150, 150), gravity: 'center' }])
      .png()
      .toBuffer();
    const good = await compareColors(ref, sameColorScene);
    const bad = await compareColors(ref, recolored);
    // Viền khối màu bị khử răng cưa khi thu nhỏ tạo màu trung gian -> không đạt 100%
    expect(good.coverage).toBeGreaterThanOrEqual(0.8);
    expect(bad.coverage).toBeLessThan(0.5);
    // Màu nền trắng của ảnh gốc bị loại khỏi bảng màu sản phẩm
    expect(good.referencePalette.some((c) => c === '#FFFFFF')).toBe(false);
  });

  it('deltaE: màu giống nhau ~0, khác hẳn > 50', () => {
    expect(deltaE({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBeCloseTo(0);
    expect(deltaE({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 })).toBeGreaterThan(50);
  });
});

describe('Mode F – ghép ảnh gốc & chuẩn hoá ảnh tham chiếu', () => {
  it('đặt nguyên ảnh gốc lên nền đúng tỷ lệ, không đổi màu sản phẩm', async () => {
    const product = await solid('#1E4DB7', 400, 300);
    const r = await composeOnBackground(product, '9:16', '#F4F1EC');
    expect([r.width, r.height]).toEqual([1080, 1920]);
    const { data } = await sharp(r.data)
      .extract({ left: 540, top: 960, width: 1, height: 1 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([0x1e, 0x4d, 0xb7]);
    const corner = await sharp(r.data)
      .extract({ left: 2, top: 2, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([corner[0], corner[1], corner[2]]).toEqual([0xf4, 0xf1, 0xec]);
  });

  it('ảnh tham chiếu lớn được thu nhỏ ≤ 2048px, chuyển JPEG', async () => {
    const big = await solid('#888888', 4000, 3000);
    const n = await normalizeReference(big);
    const meta = await sharp(n.data).metadata();
    expect(n.mimeType).toBe('image/jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBe(2048);
  });

  it('ảnh tham chiếu hỏng -> lỗi tiếng Việt', async () => {
    await expect(normalizeReference(Buffer.from('xx'))).rejects.toThrow(/không đọc được/);
  });
});
