import { defineConfig, devices } from '@playwright/test';

/**
 * E2E/giao diện: chạy trên bản build production (`next start`).
 * Chạy: pnpm --filter @acs/web build && pnpm --filter @acs/web test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
