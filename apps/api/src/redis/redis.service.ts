import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis, type RedisOptions } from 'ioredis';
import { type ApiEnv, toErrorMessage } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';

export function buildRedisOptions(env: ApiEnv): RedisOptions {
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    // Tự kết nối lại với backoff tối đa 5s
    retryStrategy: (times) => Math.min(times * 500, 5000),
  };
}

/** Client Redis dùng cho đọc/ghi thông thường (health, heartbeat...). */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private lastErrorLogAt = 0;
  readonly client: Redis;

  constructor(@Inject(APP_ENV) env: ApiEnv) {
    this.client = new Redis({
      ...buildRedisOptions(env),
      lazyConnect: true,
      // Lỗi ngay khi mất kết nối thay vì xếp hàng lệnh vô hạn
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('ready', () => this.logger.log('Đã kết nối Redis'));
    this.client.on('error', (error) => {
      // Tránh spam log khi Redis down: tối đa 1 dòng / 30s
      const now = Date.now();
      if (now - this.lastErrorLogAt > 30_000) {
        this.lastErrorLogAt = now;
        this.logger.warn(`Redis lỗi: ${toErrorMessage(error)}`);
      }
    });
    this.client.connect().catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
