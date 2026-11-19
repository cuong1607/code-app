import { Injectable } from '@nestjs/common';
import {
  type ComponentHealth,
  type HealthResponse,
  WORKER_HEARTBEAT_KEY,
  computeOverallStatus,
  nowUtcIso,
  toErrorMessage,
  workerHeartbeatSchema,
} from '@acs/shared';
import { withTimeout } from '../common/with-timeout';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StorageService } from '../storage/storage.service';

const CHECK_TIMEOUT_MS = 2500;

async function measure(
  label: string,
  check: () => Promise<Omit<ComponentHealth, 'status' | 'latencyMs'> | void>,
): Promise<ComponentHealth> {
  const started = performance.now();
  try {
    const extra = await withTimeout(check(), CHECK_TIMEOUT_MS, label);
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - started),
      ...(extra ?? {}),
    };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - started),
      message: toErrorMessage(error),
    };
  }
}

@Injectable()
export class HealthService {
  private readonly version = process.env.npm_package_version ?? '0.0.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  checkDatabase(): Promise<ComponentHealth> {
    return measure('PostgreSQL', async () => {
      await this.prisma.$queryRaw`SELECT 1`;
    });
  }

  private assertRedisReady(): void {
    const { status } = this.redis.client;
    if (status !== 'ready') throw new Error(`Chưa kết nối được Redis (trạng thái: ${status})`);
  }

  checkRedis(): Promise<ComponentHealth> {
    return measure('Redis', async () => {
      this.assertRedisReady();
      const reply = await this.redis.client.ping();
      if (reply !== 'PONG') throw new Error(`Phản hồi không mong đợi: ${reply}`);
    });
  }

  checkStorage(): Promise<ComponentHealth> {
    return measure('MinIO', async () => {
      await this.storage.ping();
      return { details: { bucket: this.storage.bucket } };
    });
  }

  /** Worker sống nếu heartbeat trong Redis còn hạn (worker đặt TTL cho key). */
  checkWorker(): Promise<ComponentHealth> {
    return measure('Worker', async () => {
      this.assertRedisReady();
      const raw = await this.redis.client.get(WORKER_HEARTBEAT_KEY);
      if (!raw) throw new Error('Không có heartbeat từ worker (worker chưa chạy?)');
      const heartbeat = workerHeartbeatSchema.parse(JSON.parse(raw));
      return {
        details: {
          workerId: heartbeat.workerId,
          lastBeatAt: heartbeat.lastBeatAt,
          ffmpeg: heartbeat.ffmpeg,
        },
      };
    });
  }

  async check(): Promise<HealthResponse> {
    const [database, redis, storage, worker] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkStorage(),
      this.checkWorker(),
    ]);
    const components = { database, redis, storage, worker };
    return {
      status: computeOverallStatus(components),
      service: 'api',
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: nowUtcIso(),
      components,
    };
  }
}
