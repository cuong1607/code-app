import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC cần để emit decorator metadata cho NestJS DI (esbuild mặc định không làm được).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Kiểm thử tích hợp (cần DB + MinIO thật) chạy riêng: pnpm test:integration
    exclude: ['test/integration/**', '**/node_modules/**'],
    environment: 'node',
    globals: false,
  },
});
