import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromHere = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // tsconfig của Next đặt jsx: "preserve"; vitest cần tự biên dịch JSX để import được file .tsx
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': fromHere('./src'),
      // "server-only" ném lỗi khi import ngoài React Server; trong test Node thì bỏ qua
      'server-only': fromHere('./src/test/server-only-stub.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
