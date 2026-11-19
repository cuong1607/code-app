import globals from 'globals';
import tseslint from 'typescript-eslint';
import { baseConfig } from './base.mjs';

/** ESLint cho các tiến trình Node.js (api, worker, shared). */
export const nodeConfig = tseslint.config(...baseConfig, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    // NestJS DI cần import giá trị (không phải `import type`) để emitDecoratorMetadata hoạt động.
    '@typescript-eslint/consistent-type-imports': 'off',
  },
});

export default nodeConfig;
