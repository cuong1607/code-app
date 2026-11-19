import { type INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WORKER_HEARTBEAT_KEY, healthResponseSchema } from '@acs/shared';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { StorageService } from '../src/storage/storage.service';

/**
 * Test HTTP thật cho /health với các phụ thuộc được giả lập (mock) ở mức client.
 * Mục đích: kiểm tra logic tổng hợp trạng thái & mã HTTP, không cần Docker.
 */
async function createApp(opts: {
  dbOk?: boolean;
  redisOk?: boolean;
  storageOk?: boolean;
  heartbeat?: string | null;
}): Promise<INestApplication> {
  const { dbOk = true, redisOk = true, storageOk = true, heartbeat = null } = opts;
  const prisma = {
    $queryRaw: vi.fn(() =>
      dbOk ? Promise.resolve([{ '?column?': 1 }]) : Promise.reject(new Error('ECONNREFUSED')),
    ),
  };
  const redis = {
    client: {
      status: redisOk ? 'ready' : 'reconnecting',
      ping: vi.fn(() => (redisOk ? Promise.resolve('PONG') : Promise.reject(new Error('down')))),
      get: vi.fn((key: string) =>
        key === WORKER_HEARTBEAT_KEY ? Promise.resolve(heartbeat) : Promise.resolve(null),
      ),
    },
  };
  const storage = {
    bucket: 'acs-media',
    ping: vi.fn(() => (storageOk ? Promise.resolve() : Promise.reject(new Error('no bucket')))),
  };

  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      HealthService,
      { provide: PrismaService, useValue: prisma },
      { provide: RedisService, useValue: redis },
      { provide: StorageService, useValue: storage },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

const validHeartbeat = JSON.stringify({
  workerId: 'worker-test',
  pid: 123,
  startedAt: '2026-01-01T00:00:00.000Z',
  lastBeatAt: '2026-01-01T00:00:10.000Z',
  ffmpeg: { available: false, error: 'not found' },
});

describe('GET /health', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('200 + ok khi mọi thành phần up', async () => {
    app = await createApp({ heartbeat: validHeartbeat });
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    const body = healthResponseSchema.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.components.worker.details?.workerId).toBe('worker-test');
  });

  it('200 + degraded khi worker chưa chạy', async () => {
    app = await createApp({ heartbeat: null });
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.components.worker.status).toBe('down');
  });

  it('503 + down khi database down', async () => {
    app = await createApp({ dbOk: false, heartbeat: validHeartbeat });
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.status).toBe('down');
    expect(res.body.components.database.message).toContain('ECONNREFUSED');
  });

  it('503 + thông báo rõ ràng khi Redis chưa kết nối', async () => {
    app = await createApp({ redisOk: false });
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.components.redis.message).toContain('Chưa kết nối được Redis');
    expect(res.body.components.worker.status).toBe('down');
  });

  it('GET /health/live luôn 200', async () => {
    app = await createApp({ dbOk: false, redisOk: false, storageOk: false });
    const res = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('route không tồn tại trả về ErrorResponse thống nhất', async () => {
    app = await createApp({});
    const res = await request(app.getHttpServer()).get('/khong-ton-tai').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.timestamp).toBe('string');
  });
});
