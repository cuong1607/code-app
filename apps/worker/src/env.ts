import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { type WorkerEnv, parseEnv, workerEnvSchema } from '@acs/shared';

function findWorkspaceRoot(start: string = process.cwd()): string | undefined {
  let current = resolve(start);
  while (true) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

/** Ưu tiên: biến hệ thống > apps/worker/.env > <root>/.env */
export function loadWorkerEnv(): WorkerEnv {
  const candidates = [resolve(process.cwd(), '.env')];
  const root = findWorkspaceRoot();
  if (root) candidates.push(resolve(root, '.env'));
  for (const file of new Set(candidates)) {
    if (existsSync(file)) loadDotenv({ path: file, quiet: true });
  }
  return parseEnv(workerEnvSchema, process.env, 'worker');
}
