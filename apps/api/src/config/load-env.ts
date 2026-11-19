import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { type ApiEnv, apiEnvSchema, parseEnv } from '@acs/shared';

/** Tìm thư mục gốc monorepo (chứa pnpm-workspace.yaml) bắt đầu từ `start`. */
export function findWorkspaceRoot(start: string = process.cwd()): string | undefined {
  let current = resolve(start);
  while (true) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/**
 * Nạp .env theo thứ tự ưu tiên: biến môi trường hệ thống > apps/api/.env > <root>/.env.
 * dotenv không ghi đè biến đã tồn tại nên nạp file ưu tiên cao trước.
 */
export function loadEnvFiles(): string[] {
  const loaded: string[] = [];
  const candidates = [resolve(process.cwd(), '.env')];
  const root = findWorkspaceRoot();
  if (root) candidates.push(resolve(root, '.env'));

  for (const file of new Set(candidates)) {
    if (existsSync(file)) {
      loadDotenv({ path: file, quiet: true });
      loaded.push(file);
    }
  }
  return loaded;
}

export function loadApiEnv(): ApiEnv {
  loadEnvFiles();
  return parseEnv(apiEnvSchema, process.env, 'api');
}
