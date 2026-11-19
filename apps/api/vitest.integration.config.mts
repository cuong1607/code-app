import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Kiểm thử TÍCH HỢP: chạy với PostgreSQL + MinIO thật (cần `pnpm infra:up` + `pnpm db:deploy`).
 * Chạy: pnpm --filter @acs/api test:integration
 */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.int.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
