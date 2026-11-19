import { type INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { QueueService } from '../src/queue/queue.service';
import { SystemController } from '../src/queue/system.controller';
import { RedisService } from '../src/redis/redis.service';

/** Kiểm tra /system/ping với Queue BullMQ giả lập; trọng tâm là xử lý lỗi & fail-fast. */
async function createApp(redisStatus: string, add = vi.fn(async () => ({ id: '42' }))) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SystemController],
    providers: [
      { provide: RedisService, useValue: { client: { status: redisStatus } } },
      {
        provide: QueueService,
        useFactory: (redis: RedisService) => {
          // Dựng QueueService thật nhưng thay systemQueue bằng mock (không chạm Redis)
          const service = Object.create(QueueService.prototype) as QueueService;
          Object.assign(service, {
            redis,
            systemQueue: { add, getJob: vi.fn(async () => null), close: vi.fn(async () => {}) },
          });
          return service;
        },
        inject: [RedisService],
      },
      { provide: APP_FILTER, useClass: AllExceptionsFilter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe('/system/ping', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('202 + jobId khi Redis sẵn sàng', async () => {
    app = await createApp('ready');
    const res = await request(app.getHttpServer()).post('/system/ping').send({}).expect(202);
    expect(res.body).toEqual({ jobId: '42' });
  });

  it('503 ngay lập tức (không treo) khi Redis chưa kết nối', async () => {
    const add = vi.fn();
    app = await createApp('reconnecting', add);
    const started = Date.now();
    const res = await request(app.getHttpServer()).post('/system/ping').send({}).expect(503);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(add).not.toHaveBeenCalled();
  });

  it('422 khi note quá dài', async () => {
    app = await createApp('ready');
    const res = await request(app.getHttpServer())
      .post('/system/ping')
      .send({ note: 'x'.repeat(201) })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('404 khi job không tồn tại', async () => {
    app = await createApp('ready');
    const res = await request(app.getHttpServer()).get('/system/ping/khong-co').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
