import { resolve } from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Dùng chung file .env ở thư mục gốc monorepo (apps/web/.env.local vẫn được ưu tiên nếu có).
loadEnvConfig(resolve(process.cwd(), '../..'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
