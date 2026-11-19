import { expect, test } from '@playwright/test';
import { cleanup, createProduct, runPrefix } from './helpers';

/**
 * AI Script Studio – luồng giao diện đầy đủ với MockScriptProvider
 * (AI_MOCK_PROVIDER_ENABLED=true ở môi trường dev; nội dung có nhãn MOCK, không gọi AI thật).
 */
const P = runPrefix();

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await cleanup(P);
});

test('tạo 3 biến thể, xem tab, sửa, lưu phiên bản mới, tải lại vẫn còn', async ({ page }) => {
  await createProduct(P, 'SC', `Áo khoác gió ${P}`);
  await page.goto('/studio/scripts');

  // Chọn sản phẩm thật từ database
  await page.getByRole('button', { name: 'Chọn sản phẩm' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Tìm sản phẩm…').fill(P);
  await dialog.getByLabel(`Chọn Áo khoác gió ${P}`).click();
  await dialog.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByRole('list', { name: 'Sản phẩm đã chọn' })).toContainText(`${P}-SC`);

  // Template + provider mock
  await page.getByRole('radio', { name: /Storytelling/ }).click();
  await page.getByLabel('Nhà cung cấp').selectOption('mock');
  await expect(page.getByText('MOCK – KHÔNG PHẢI AI').first()).toBeVisible();
  await page
    .getByRole('radiogroup', { name: 'Số phiên bản' })
    .getByRole('radio', { name: '3' })
    .click();
  await expect(page.getByText(/Chi phí ước tính/)).toBeVisible();

  await page.getByRole('button', { name: 'Tạo 3 kịch bản bằng AI' }).click();
  const result = page.getByRole('region', { name: 'Kết quả kịch bản' });
  await expect(result.getByText(/Hoàn thành/)).toBeVisible({ timeout: 30_000 });
  const compare = result.getByRole('region', { name: 'So sánh phiên bản' });
  await expect(compare.locator('tbody tr')).toHaveCount(3);
  await expect(result.getByText('Đã lưu', { exact: true })).toBeVisible();

  // Chuyển tab không gọi AI – chỉ hiển thị dữ liệu đã có
  await result.getByRole('tab', { name: /Phân cảnh/ }).click();
  await expect(
    result.getByRole('list', { name: 'Danh sách cảnh' }).getByRole('listitem').first(),
  ).toBeVisible();
  await result.getByRole('tab', { name: 'Lời thoại' }).click();
  await expect(result.getByTestId('narration')).toContainText('Bản mô phỏng');
  await expect(result.getByText(/dự kiến/).first()).toBeVisible();
  await result.getByRole('tab', { name: 'Caption và hashtag' }).click();
  await expect(result.getByRole('textbox', { name: 'Caption', exact: true })).toHaveValue(
    /\[MOCK\]/,
  );

  // Sửa tay -> "Chưa lưu" -> lưu thành phiên bản mới
  await result.getByRole('tab', { name: 'Kịch bản' }).click();
  await result.getByLabel('Tiêu đề').fill(`${P} kịch bản đã sửa`);
  await expect(result.getByText('Chưa lưu')).toBeVisible();
  await result.getByRole('button', { name: 'Lưu thành phiên bản mới' }).click();
  await expect(page.getByText(/Đã lưu thành phiên bản 2/)).toBeVisible();
  await result.getByRole('tab', { name: /Lịch sử phiên bản/ }).click();
  await expect(
    result.getByRole('list', { name: 'Lịch sử phiên bản' }).getByRole('listitem'),
  ).toHaveCount(2);

  // Tạo lại 1 cảnh bằng AI -> phiên bản 3, phiên bản cũ còn nguyên
  await result.getByRole('tab', { name: /Phân cảnh/ }).click();
  await result.getByRole('button', { name: 'Tạo lại cảnh 2' }).click();
  await expect(page.getByText(/Đã tạo lại cảnh 2 – lưu thành phiên bản 3/)).toBeVisible({
    timeout: 30_000,
  });

  // Refresh: nội dung còn trong DB (mở lại không gọi AI)
  const url = new URL(page.url());
  await page.reload();
  expect(new URL(page.url()).pathname).toBe(url.pathname);
  const select = page.getByLabel('Mở kịch bản đã lưu');
  const value = await select
    .locator('option', { hasText: `${P} kịch bản đã sửa` })
    .first()
    .getAttribute('value');
  await select.selectOption(value!);
  await expect(result.getByLabel('Tiêu đề')).toHaveValue(`${P} kịch bản đã sửa`);
  await expect(result.getByText('Phiên bản 3/3')).toBeVisible();
  await result.getByRole('tab', { name: /Lịch sử phiên bản/ }).click();
  await expect(
    result.getByRole('list', { name: 'Lịch sử phiên bản' }).getByRole('listitem'),
  ).toHaveCount(3);
  await result.getByRole('button', { name: 'Mở phiên bản 1' }).click();
  await expect(result.getByText('Phiên bản 1/3')).toBeVisible();
  await expect(result.getByRole('tab', { name: 'Kịch bản' })).toBeVisible();
});

test('dùng kịch bản làm đầu vào tạo video', async ({ page }) => {
  await page.goto('/studio/scripts');
  const select = page.getByLabel('Mở kịch bản đã lưu');
  const value = await select
    .locator('option', { hasText: `${P} kịch bản đã sửa` })
    .first()
    .getAttribute('value');
  await select.selectOption(value!);
  await page.getByRole('button', { name: 'Dùng làm đầu vào tạo video' }).click();
  await expect(page).toHaveURL(/\/studio\/videos\?products=.+&script=/);
  await expect(page.getByRole('status').filter({ hasText: 'Kịch bản đầu vào' })).toContainText(
    `${P} kịch bản đã sửa`,
  );
});

test('Cài đặt: provider hiển thị trạng thái thật, không có ô nhập API key', async ({ page }) => {
  await page.goto('/settings?tab=providers');
  await expect(page.getByText('Anthropic Claude')).toBeVisible();
  await expect(page.getByText(/Giao diện không nhận/)).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.goto('/settings?tab=cost');
  await expect(page.getByText(/Chi phí AI \(ước tính/)).toBeVisible();
  await expect(page.getByLabel('Ngân sách AI mỗi ngày (USD)')).toBeVisible();
});
