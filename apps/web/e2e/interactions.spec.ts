import { expect, test } from '@playwright/test';

/** Điều hướng & layout (không phụ thuộc dữ liệu). */
test.describe('điều hướng', () => {
  test('sidebar chuyển trang, có active state và thu gọn được (ghi nhớ khi tải lại)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await nav.getByRole('link', { name: 'Xưởng video' }).click();
    await expect(page).toHaveURL(/\/studio\/videos$/);
    await expect(nav.getByRole('link', { name: 'Xưởng video' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await page.getByRole('button', { name: 'Thu gọn thanh điều hướng' }).click();
    await expect(page.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Mở rộng thanh điều hướng' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở rộng thanh điều hướng' }).click();
  });

  test('menu mobile mở ngăn kéo và điều hướng', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
    await page.getByRole('dialog').getByRole('link', { name: 'Lịch đăng TikTok' }).click();
    await expect(page).toHaveURL(/\/publishing$/);
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('workspace thật từ API + trạng thái chế độ phát triển', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dashboard');
    await expect(page.getByText('Workspace phát triển').first()).toBeVisible();
    await expect(page.getByText('Chưa đăng nhập')).toBeVisible();
  });
});

test.describe('cài đặt', () => {
  // Phase 03: API key CHỈ cấu hình bằng biến môi trường server – giao diện không có ô nhập key
  test('API key không nhập ở giao diện; trạng thái provider lấy từ server', async ({ page }) => {
    await page.goto('/settings?tab=providers');
    await expect(page.getByText('Anthropic Claude')).toBeVisible();
    await expect(page.getByLabel('API key')).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByText('ANTHROPIC_API_KEY').first()).toBeVisible();
    const body = await page.content();
    expect(body).not.toMatch(/sk-ant-|sk-proj-/);
  });

  test('lưu ngân sách vào database, tải lại vẫn còn', async ({ page }) => {
    await page.goto('/settings?tab=cost');
    const budget = page.getByLabel('Ngân sách tháng (USD)');
    const original = await budget.inputValue();
    const next = original === '123' ? '124' : '123';
    await budget.fill(next);
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Đã lưu cài đặt vào database')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Ngân sách tháng (USD)')).toHaveValue(next);
    // khôi phục
    await page.getByLabel('Ngân sách tháng (USD)').fill(original);
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Đã lưu cài đặt vào database').first()).toBeVisible();
  });
});
