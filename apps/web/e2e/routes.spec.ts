import { expect, test } from '@playwright/test';

const ROUTES = [
  { path: '/dashboard', heading: 'Tổng quan' },
  { path: '/products', heading: 'Sản phẩm' },
  { path: '/studio/scripts', heading: 'Kịch bản AI' },
  { path: '/studio/images', heading: 'Xưởng ảnh AI' },
  { path: '/studio/videos', heading: 'Xưởng video' },
  { path: '/library', heading: 'Thư viện' },
  { path: '/publishing', heading: 'Lịch đăng TikTok' },
  { path: '/settings', heading: 'Cài đặt' },
];

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1024', width: 1024, height: 768 },
  { name: '390', width: 390, height: 844 },
];

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const route of ROUTES) {
      test(`${route.path} hiển thị, không lỗi console, không tràn ngang`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
        page.on('console', (msg) => {
          if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
        });

        const response = await page.goto(route.path);
        expect(response?.status(), 'HTTP status').toBeLessThan(400);
        await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(overflow, 'Không được tràn ngang toàn trang').toBeLessThanOrEqual(1);

        await page.screenshot({
          // Thư mục riêng: Playwright dọn sạch `test-results` mỗi lần chạy
          path: `e2e-screenshots/${vp.name}${route.path.replaceAll('/', '_')}.png`,
          fullPage: vp.width !== 1440,
        });
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  });
}

test('/ chuyển hướng tới /dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
});
