import { expect, test } from '@playwright/test';

test.describe('điều hướng', () => {
  test('sidebar chuyển trang, có active state và thu gọn được', async ({ page }) => {
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
    // Trạng thái thu gọn được ghi nhớ
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
});

test.describe('sản phẩm', () => {
  test('tìm kiếm không dấu và lọc danh mục', async ({ page }) => {
    await page.goto('/products');
    const table = page.getByRole('table', { name: 'Danh sách sản phẩm' });
    await expect(table.getByRole('row')).toHaveCount(11); // header + 10 dòng
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill('ao thun');
    await expect(
      table.getByRole('button', { name: 'Áo thun cotton oversize', exact: true }),
    ).toBeVisible();
    await expect(table.getByRole('row')).toHaveCount(2);

    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill('');
    await page.getByRole('combobox', { name: 'Lọc theo danh mục' }).selectOption('my-pham');
    await expect(table.getByRole('row')).toHaveCount(6); // 5 mỹ phẩm
  });

  test('form thêm sản phẩm báo lỗi validation tiếng Việt và tạo bản nháp', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Thêm sản phẩm' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(dialog.getByText('Tên sản phẩm phải có ít nhất 2 ký tự')).toBeVisible();
    await expect(dialog.getByText('Vui lòng chọn danh mục')).toBeVisible();

    await dialog.getByLabel('Tên sản phẩm').fill('Sản phẩm kiểm thử');
    await dialog.getByLabel('SKU').fill('TEST-01');
    await dialog.getByLabel('Danh mục').selectOption('gia-dung');
    await dialog.getByLabel('Giá bán (VND)').fill('150000');
    await dialog.getByRole('button', { name: 'Lưu bản nháp' }).click();
    await expect(dialog).toBeHidden();
    const row = page.getByRole('row').filter({ hasText: 'Sản phẩm kiểm thử' });
    await expect(row).toBeVisible();
    await expect(row.getByText('NHÁP CỤC BỘ')).toBeVisible();
  });

  test('nút import chưa có backend bị vô hiệu hoá', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('button', { name: /Import Excel\/CSV/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: /Import URL/ })).toBeDisabled();
  });
});

test.describe('Video Factory', () => {
  test('chọn sản phẩm → tạo luồng nháp; chạy/tạm dừng/dừng bị khoá', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/studio/videos');
    await expect(page.getByRole('button', { name: 'Tạo luồng sản xuất' })).toBeDisabled();
    for (const name of ['Chạy tất cả', 'Tạm dừng', 'Dừng']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    }

    await page.getByRole('button', { name: 'Chọn sản phẩm' }).click();
    const picker = page.getByRole('dialog');
    await picker.getByRole('checkbox', { name: 'Chọn Áo thun cotton oversize' }).click();
    // (Sản phẩm "Lưu trữ" bị loại khỏi danh sách chọn – dùng sản phẩm đang bán)
    await expect(picker.getByRole('checkbox', { name: 'Chọn Serum vitamin C 30ml' })).toHaveCount(
      0,
    );
    await picker.getByRole('checkbox', { name: 'Chọn Kem chống nắng SPF50+' }).click();
    await picker.getByRole('button', { name: 'Xác nhận' }).click();

    // 2 sản phẩm × 2 phiên bản mặc định = 4 video
    await expect(page.getByText('2 đã chọn')).toBeVisible();
    await page.getByRole('button', { name: 'Tạo luồng sản xuất' }).click();
    const table = page.getByRole('table', { name: 'Bảng tác vụ Video Factory' });
    await expect(table.getByRole('row').filter({ hasText: 'NHÁP CỤC BỘ' })).toHaveCount(4);

    // Tab "Chờ xử lý" lọc đúng và mở chi tiết
    await page.getByRole('tab', { name: /Chờ xử lý/ }).click();
    await table
      .getByRole('button', { name: 'Nháp · Áo thun cotton oversize · bản 1', exact: true })
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Luồng nháp – chưa được gửi đi render')).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Chạy lại' })).toBeDisabled();
  });
});

test.describe('Lịch đăng TikTok', () => {
  test('báo lỗi khi thiếu dữ liệu; tạo bài nháp chờ kiểm duyệt theo giờ VN', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/publishing');
    await page.getByRole('button', { name: /Tạo lịch đăng/ }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Chọn tài khoản TikTok' });
    await expect(alert).toBeVisible();

    await page.getByRole('combobox', { name: /^Tài khoản TikTok/ }).selectOption('acc-1');
    const firstVideo = page.getByRole('checkbox', { name: /^Chọn Batch/ }).first();
    await firstVideo.click();
    await page.getByLabel('Bắt đầu đăng lúc').fill('2030-01-15T08:00');
    await page.getByRole('button', { name: /Tạo lịch đăng/ }).click();

    const table = page.getByRole('table', { name: 'Danh sách lịch đăng TikTok' });
    const draft = table.getByRole('row').filter({ hasText: 'NHÁP CỤC BỘ' });
    await expect(draft).toHaveCount(1);
    await expect(draft.getByText('15/01/2030 08:00')).toBeVisible();
    await expect(draft.getByText('Chờ kiểm duyệt')).toBeVisible();
    await expect(page.getByRole('button', { name: /Gửi lên TikTok/ })).toBeDisabled();
  });
});

test.describe('cài đặt', () => {
  test('API key là ô mật khẩu rỗng, không tự điền', async ({ page }) => {
    await page.goto('/settings?tab=providers');
    const keys = page.getByLabel('API key');
    await expect(keys).toHaveCount(4);
    for (const key of await keys.all()) {
      await expect(key).toHaveAttribute('type', 'password');
      await expect(key).toHaveValue('');
      await expect(key).toHaveAttribute('autocomplete', 'off');
    }
  });
});
