import { type Page, expect, test } from '@playwright/test';
import { api, cleanup, runPrefix, uniquePng } from './helpers';

/**
 * AI Image Studio – luồng giao diện với MockImageProvider (AI_MOCK_PROVIDER_ENABLED=true ở dev;
 * ảnh có dải chữ MOCK, KHÔNG gọi AI thật). Worker ảnh chạy trong tiến trình API (pnpm dev).
 */
const P = runPrefix();
const NAME = `Bộ chăn ga gối ${P}`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const ctx = await api();
  try {
    const res = await ctx.post('/products', {
      data: {
        sku: `${P}-BO`,
        name: NAME,
        category: 'Chăn ga gối',
        sellingPrice: 650000,
        status: 'active',
        attributes: {
          'Màu sắc': 'Xanh dương',
          'Bộ gồm': '1 ga, 2 vỏ gối',
          'Kích thước': '1m6 x 2m',
        },
      },
    });
    const product = await res.json();
    if (!res.ok()) throw new Error(`Tạo sản phẩm lỗi: ${JSON.stringify(product)}`);
    // Upload ảnh gốc qua đúng luồng presigned -> MinIO
    const body = uniquePng(P);
    const ticket = await (
      await ctx.post('/media/uploads', {
        data: { filename: `${P}-anh-goc.png`, contentType: 'image/png', size: body.length },
      })
    ).json();
    const put = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: ticket.headers,
      body: new Uint8Array(body),
    });
    if (!put.ok) throw new Error(`PUT MinIO lỗi ${put.status}`);
    const complete = await (await ctx.post(`/media/uploads/${ticket.uploadId}/complete`)).json();
    await ctx.post(`/products/${product.id}/media`, {
      data: { mediaAssetIds: [complete.asset.id] },
    });
  } finally {
    await ctx.dispose();
  }
});

test.afterAll(async () => {
  await cleanup(P);
});

async function pickProduct(page: Page) {
  await page.getByRole('button', { name: 'Chọn sản phẩm' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Tìm sản phẩm…').fill(P);
  await dialog.getByLabel(`Chọn ${NAME}`).click();
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();
}

test('sản phẩm thật + ảnh MinIO -> 3 biến thể (Mock) -> so sánh -> duyệt/từ chối -> Video Factory', async ({
  page,
}) => {
  await page.goto('/studio/images');
  await expect(page.getByText(/chưa được xác minh/)).toBeVisible();
  await pickProduct(page);

  // Dữ kiện lấy từ thuộc tính sản phẩm (không suy đoán) + ảnh gốc từ MinIO
  await expect(page.getByText('Dữ kiện sẽ đưa vào prompt')).toBeVisible();
  await expect(page.getByText('Xanh dương')).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'Ảnh tham chiếu' }).getByRole('checkbox'),
  ).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: 'Ảnh tham chiếu' }).getByRole('checkbox').first(),
  ).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', { name: /Nhiều biến thể/ }).click();
  await expect(page.getByRole('radio', { name: /Sắp xếp bộ chăn ga gối/ })).toBeVisible();
  await page.getByLabel('Nhà cung cấp AI').selectOption('mock');
  await expect(page.getByText(/Mock không phải AI/)).toBeVisible();
  await expect(page.getByText('Chi phí ước tính')).toBeVisible();
  await page.getByText('Xem prompt & quy tắc giữ đúng sản phẩm').click();
  await expect(page.getByText('Giữ đúng màu sắc: Xanh dương')).toBeVisible();

  await page.getByRole('button', { name: 'Tạo 3 ảnh' }).click();
  const results = page.getByRole('region', { name: 'Kết quả' });
  await expect(results.getByTestId('image-item')).toHaveCount(3);
  await expect(results.getByText('Chờ duyệt')).toHaveCount(3, { timeout: 45_000 });
  await expect(results.getByText('MOCK – KHÔNG PHẢI ẢNH AI').first()).toBeVisible();

  // So sánh ảnh gốc / ảnh mới, zoom, duyệt
  await results.getByRole('button', { name: 'So sánh ảnh 1', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Ảnh gốc (bất biến)')).toBeVisible();
  await expect(dialog.getByText('Kiểm tra tự động (tham khảo)')).toBeVisible();
  await dialog.getByRole('radio', { name: '2×' }).click();
  await dialog.getByRole('button', { name: 'Duyệt ảnh' }).click();
  await expect(page.getByText('Đã duyệt ảnh')).toBeVisible();
  await expect(dialog.getByText('Đã duyệt', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await results.getByRole('button', { name: 'Từ chối ảnh 2', exact: true }).click();
  await expect(results.getByText('Đã từ chối')).toBeVisible();

  // Tải lại trang: tác vụ vẫn còn (lưu DB), mở lại không gọi AI
  await page.reload();
  await page.getByRole('list', { name: 'Danh sách tác vụ' }).getByText(NAME).first().click();
  await expect(results.getByText('Đã duyệt', { exact: true })).toBeVisible();

  // Chỉ ảnh đã duyệt được chuyển sang Video Factory
  await results.getByRole('link', { name: /Sử dụng làm ảnh đầu vào Video Factory \(1\)/ }).click();
  await expect(page).toHaveURL(/\/studio\/videos\?products=.+&images=.+/);
  await expect(page.getByText(NAME).first()).toBeVisible();
});

test('Mode F ghép ảnh gốc: không phải AI, gắn nhãn rõ', async ({ page }) => {
  await page.goto('/studio/images');
  await pickProduct(page);
  await page.getByRole('radio', { name: /Ghép ảnh gốc/ }).click();
  await expect(page.getByText('Không tốn chi phí AI')).toBeVisible();
  await page.getByRole('button', { name: 'Ghép ảnh gốc' }).click();
  const results = page.getByRole('region', { name: 'Kết quả' });
  await expect(results.getByText('ẢNH GHÉP – KHÔNG PHẢI AI')).toBeVisible();
  await expect(results.getByText('Chờ duyệt')).toHaveCount(1, { timeout: 30_000 });
});

test('Cài đặt: trạng thái provider ảnh thật, không có ô nhập API key', async ({ page }) => {
  await page.goto('/settings?tab=providers');
  const gemini = page.getByRole('listitem').filter({ hasText: 'Google Gemini (ảnh)' });
  await expect(gemini).toContainText('Chưa cấu hình');
  await expect(gemini).toContainText('GOOGLE_API_KEY');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});
