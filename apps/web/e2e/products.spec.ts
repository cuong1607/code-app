import { expect, test } from '@playwright/test';
import { cleanup, createProduct, runPrefix, uniquePng } from './helpers';

const P = runPrefix();

test.afterAll(async () => {
  await cleanup(P);
});

test.describe.configure({ mode: 'serial' });

test.describe('Sản phẩm (dữ liệu thật PostgreSQL)', () => {
  test('form không hợp lệ báo lỗi tiếng Việt; tạo sản phẩm lưu DB; tải lại vẫn còn', async ({
    page,
  }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Thêm sản phẩm' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Lưu sản phẩm' }).click();
    await expect(dialog.getByText('Tên sản phẩm phải có ít nhất 2 ký tự')).toBeVisible();
    await expect(dialog.getByText('Vui lòng nhập danh mục')).toBeVisible();
    await expect(dialog.getByText('Vui lòng nhập giá bán')).toBeVisible();

    await dialog.getByLabel('Tên sản phẩm').fill(`Áo khoác dù ${P}`);
    await dialog.getByLabel('SKU').fill(`${P}-a`);
    await dialog.getByLabel('Danh mục').fill('Thời trang E2E');
    await dialog.getByLabel('Giá vốn').fill('120.000');
    await dialog.getByLabel('Giá bán').fill('259.000');
    await dialog.getByRole('button', { name: 'Thêm thông số' }).click();
    await dialog.getByLabel('Tên thông số 1').fill('Màu sắc');
    await dialog.getByLabel('Giá trị thông số 1').fill('Xanh rêu');
    await dialog.getByRole('button', { name: 'Lưu sản phẩm' }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
    const row = page.getByRole('row').filter({ hasText: `${P}-A` });
    await expect(row).toBeVisible();
    await expect(row.getByText('259.000')).toBeVisible();
    await page.reload();
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(P);
    await expect(page.getByRole('row').filter({ hasText: `${P}-A` })).toBeVisible();
  });

  test('SKU trùng: lỗi hiển thị ngay dưới ô SKU', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Thêm sản phẩm' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Tên sản phẩm').fill('Trùng SKU');
    await dialog.getByLabel('SKU').fill(`${P}-A`);
    await dialog.getByLabel('Danh mục').fill('X');
    await dialog.getByLabel('Giá bán').fill('1000');
    await dialog.getByRole('button', { name: 'Lưu sản phẩm' }).click();
    await expect(dialog.getByText(/SKU ".*" đã tồn tại/).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Huỷ' }).click();
  });

  test('tìm kiếm tiếng Việt không dấu + phân trang', async ({ page }) => {
    for (const n of ['b1', 'b2', 'b3']) await createProduct(P, n, `Đèn ngủ gốm sứ ${P} ${n}`);
    await page.goto('/products');
    await page
      .getByRole('searchbox', { name: 'Tìm kiếm' })
      .fill(`den ngu gom su ${P.toLowerCase()}`);
    const table = page.getByRole('table', { name: 'Danh sách sản phẩm' });
    await expect(table.getByRole('row')).toHaveCount(4); // header + 3
    await page.getByRole('combobox', { name: 'Số dòng mỗi trang' }).selectOption('10');
    await expect(page.getByText('1–3 / 3')).toBeVisible();
  });

  test('sửa và xoá có xác nhận', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(`${P}-B3`);
    const row = page.getByRole('row').filter({ hasText: `${P}-B3` });
    await row.getByRole('button', { name: /Thao tác cho/ }).click();
    await page.getByRole('menuitem', { name: 'Chỉnh sửa' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Giá bán').fill('175000');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(row.getByText('175.000')).toBeVisible();

    await row.getByRole('button', { name: /Thao tác cho/ }).click();
    await page.getByRole('menuitem', { name: 'Xoá sản phẩm' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
    await expect(page.getByText('Đã xoá 1 sản phẩm')).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: `${P}-B3` })).toHaveCount(0);
  });

  test('chi tiết: upload nhiều ảnh lên MinIO, đổi ảnh đại diện, sắp xếp, gỡ ảnh, file sai định dạng', async ({
    page,
  }) => {
    const product = await createProduct(P, 'img', `Sản phẩm ảnh ${P}`);
    await page.goto(`/products/${product.id}`);
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    const input = page.locator('input[type=file]');
    await input.setInputFiles([
      { name: `${P.toLowerCase()}-1.png`, mimeType: 'image/png', buffer: uniquePng(`${P}1`) },
      { name: `${P.toLowerCase()}-2.png`, mimeType: 'image/png', buffer: uniquePng(`${P}2`) },
    ]);
    await expect(page.getByText('Đã tải lên và gắn 2 ảnh')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Hình ảnh (2)' })).toBeVisible();
    const gallery = page.getByRole('list', { name: 'Bộ sưu tập ảnh' });
    await expect(gallery.getByRole('img')).toHaveCount(2);

    // Ảnh thứ 2 -> đại diện
    await page
      .getByRole('button', { name: `Đặt ${P.toLowerCase()}-2.png làm ảnh đại diện` })
      .click();
    await expect(
      page.getByRole('button', { name: `${P.toLowerCase()}-2.png là ảnh đại diện` }),
    ).toBeVisible();
    // Sắp xếp: đưa ảnh 2 sang trái
    await page.getByRole('button', { name: `Đưa ${P.toLowerCase()}-2.png sang trái` }).click();
    await expect(gallery.getByRole('listitem').first().getByRole('img')).toHaveAttribute(
      'alt',
      `${P.toLowerCase()}-2.png`,
    );
    // Tải lại: thứ tự & ảnh đại diện được lưu
    await page.reload();
    await expect(
      page
        .getByRole('list', { name: 'Bộ sưu tập ảnh' })
        .getByRole('listitem')
        .first()
        .getByRole('img'),
    ).toHaveAttribute('alt', `${P.toLowerCase()}-2.png`);
    // Gỡ ảnh 1 khỏi sản phẩm
    await page.getByRole('button', { name: `Gỡ ${P.toLowerCase()}-1.png khỏi sản phẩm` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Gỡ ảnh' }).click();
    await expect(page.getByRole('heading', { name: 'Hình ảnh (1)' })).toBeVisible();

    // File sai định dạng bị chặn
    await page.locator('input[type=file]').setInputFiles({
      name: 'tai-lieu.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    });
    await expect(page.getByText('Một số file không được chọn')).toBeVisible();
  });
});

test.describe('Thư viện (MinIO thật)', () => {
  test('upload, xem metadata, tải xuống, xoá có xác nhận', async ({ page }) => {
    await page.goto('/library');
    const name = `${P.toLowerCase()}-lib.png`;
    await page
      .getByLabel('Chọn ảnh để tải lên')
      .setInputFiles({ name, mimeType: 'image/png', buffer: uniquePng(`${P}lib`) });
    await expect(page.getByText('Đã tải lên 1 ảnh')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('searchbox', { name: 'Tìm kiếm' }).fill(name);
    await page.getByRole('button', { name: `Xem ${name}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('image/png')).toBeVisible();
    await expect(dialog.getByText('1 × 1 px')).toBeVisible();

    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Tải xuống' }).click();
    expect((await download).suggestedFilename()).toBe(name);

    await dialog.getByRole('button', { name: 'Xoá' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Xoá', exact: true }).click();
    await expect(page.getByText('Đã xoá 1 tài nguyên')).toBeVisible();
    await expect(page.getByRole('button', { name: `Xem ${name}` })).toHaveCount(0);
  });
});
