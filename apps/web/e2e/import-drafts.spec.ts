import { expect, test } from '@playwright/test';
import { cleanup, createProduct, runPrefix } from './helpers';

const P = runPrefix();

test.afterAll(async () => {
  await cleanup(P);
});

test.describe.configure({ mode: 'serial' });

test('Import CSV: preview, mapping tự động, báo lỗi từng dòng, nhập dòng hợp lệ', async ({
  page,
}) => {
  await createProduct(P, 'DUP', `Sản phẩm có sẵn ${P}`);
  const csv = [
    'SKU,Tên sản phẩm,Danh mục,Giá vốn,Giá bán,Màu sắc,URL hình ảnh',
    `${P}-I1,Áo len ${P},Thời trang,90.000,199.000,Be,https://cdn.example.com/a.jpg`,
    `${P}-I2,Quần short ${P},Thời trang,,abc,,`,
    `${P}-DUP,Trùng SKU ${P},Thời trang,,120000,,`,
    `${P}-I3,Mũ ${P},Phụ kiện,,"85,000",Đen,`,
  ].join('\n');

  await page.goto('/products');
  await page.getByRole('button', { name: 'Import Excel/CSV' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Chọn file import').setInputFiles({
    name: 'san-pham.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });
  await expect(dialog.getByText(/Bước 2\/3/)).toBeVisible();
  await expect(dialog.getByLabel('Cột cho SKU')).toHaveValue('0');
  await expect(dialog.getByLabel('Cột cho Giá bán')).toHaveValue('4');

  await dialog.getByRole('button', { name: 'Kiểm tra dữ liệu' }).click();
  await expect(dialog.getByText('Kết quả kiểm tra (chưa ghi dữ liệu)')).toBeVisible();
  await expect(dialog.getByText('Giá bán "abc" không phải số hợp lệ')).toBeVisible();
  await expect(dialog.getByText('SKU đã tồn tại – bỏ qua')).toBeVisible();

  await dialog.getByRole('button', { name: 'Nhập 2 dòng hợp lệ' }).click();
  await expect(dialog.getByText('Đã lưu vào database.')).toBeVisible();
  await expect(dialog.getByText(/1 URL ảnh nhưng/)).toBeVisible();
  // Nút "Đóng" ở chân dialog (nút X góc trên cũng có nhãn "Đóng")
  await dialog.getByRole('button', { name: 'Đóng' }).first().click();

  await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
  await expect(page.getByRole('row').filter({ hasText: `${P}-I1` })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${P}-I3` })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${P}-I2` })).toHaveCount(0);
});

test('Xưởng video: tạo luồng nháp lưu DB, tải lại vẫn còn, xoá', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/videos');
  await expect(page.getByRole('button', { name: 'Tạo luồng sản xuất' })).toBeDisabled();
  for (const name of ['Chạy tất cả', 'Tạm dừng', 'Dừng']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: 'Chọn sản phẩm' }).click();
  const picker = page.getByRole('dialog');
  await picker.getByRole('searchbox').fill(`Áo len ${P}`);
  await picker.getByRole('checkbox', { name: `Chọn Áo len ${P}` }).click();
  await picker.getByRole('button', { name: 'Xác nhận' }).click();
  await expect(page.getByText('1 đã chọn')).toBeVisible();

  await page.getByRole('button', { name: 'Tạo luồng sản xuất' }).click();
  await expect(page.getByText('Đã lưu 2 luồng sản xuất nháp')).toBeVisible();
  const table = page.getByRole('table', { name: 'Bảng tác vụ Video Factory' });
  await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
  await expect(table.getByRole('row')).toHaveCount(3);

  await page.reload();
  await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
  const rows = page.getByRole('table', { name: 'Bảng tác vụ Video Factory' }).getByRole('row');
  await expect(rows).toHaveCount(3);
  // Prompt đã điền biến {product}
  await expect(rows.nth(1)).toContainText(`Áo len ${P}`);
});

test('Lịch đăng: chọn luồng video, tạo lịch theo giờ VN, lưu DB, sửa & xoá', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/publishing');
  await page.getByRole('button', { name: /Tạo lịch đăng/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chọn ít nhất 1 video' })).toBeVisible();

  await page.getByRole('checkbox', { name: `Chọn Áo len ${P} · bản 1` }).click();
  await page.getByLabel('Caption mặc định').fill(`${P} {product} giảm giá`);
  await page.getByLabel('Bắt đầu đăng lúc').fill('2030-01-15T08:00');
  await page.getByRole('button', { name: /Tạo lịch đăng/ }).click();
  await expect(page.getByText('Đã lưu 1 bài đăng nháp')).toBeVisible();

  await page.reload();
  await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
  const row = page
    .getByRole('table', { name: 'Danh sách lịch đăng TikTok' })
    .getByRole('row')
    .filter({ hasText: P });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('15/01/2030 08:00')).toBeVisible();
  await expect(row.getByText('Chờ kiểm duyệt')).toBeVisible();
  await expect(row.getByText(`${P} Áo len ${P} giảm giá`)).toBeVisible();
  await expect(page.getByRole('button', { name: /Gửi lên TikTok/ })).toBeDisabled();

  await row.getByRole('button', { name: /Thao tác cho/ }).click();
  await page.getByRole('menuitem', { name: 'Chỉnh sửa nháp' }).click();
  await page.getByLabel('Ngày giờ dự kiến (giờ VN)').fill('2030-01-16T21:30');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(row.getByText('16/01/2030 21:30')).toBeVisible();

  await row.getByRole('button', { name: /Thao tác cho/ }).click();
  await page.getByRole('menuitem', { name: 'Xoá nháp' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá nháp' }).click();
  await expect(page.getByText('Đã xoá 1 bài nháp')).toBeVisible();
});

test('Kịch bản: soạn tay từ khuôn mẫu (không AI), lưu DB và mở lại', async ({ page }) => {
  await page.goto('/studio/scripts');
  await page.getByRole('button', { name: 'Soạn tay từ khuôn mẫu' }).click();
  const result = page.getByRole('region', { name: 'Kết quả kịch bản' });
  await expect(result.getByText('TỪ KHUÔN MẪU – KHÔNG PHẢI AI')).toBeVisible();
  await expect(result.getByText('Chưa lưu')).toBeVisible();
  await result.getByLabel('Tiêu đề').fill(`Kịch bản ${P}`);
  await result.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu kịch bản vào database')).toBeVisible();
  await page.reload();
  const select = page.getByLabel('Mở kịch bản đã lưu');
  const value = await select
    .locator('option', { hasText: `Kịch bản ${P}` })
    .first()
    .getAttribute('value');
  await select.selectOption(value!);
  await expect(
    page.getByRole('region', { name: 'Kết quả kịch bản' }).getByLabel('Tiêu đề'),
  ).toHaveValue(`Kịch bản ${P}`);
  await page.getByRole('button', { name: 'Xoá kịch bản' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá' }).click();
  await expect(page.getByText(/Đã xoá kịch bản/)).toBeVisible();
});
