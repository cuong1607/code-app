import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { loadApiEnv } from '../../src/config/load-env';
import { PrismaService } from '../../src/prisma/prisma.service';

/** Khởi động API đầy đủ (DB + MinIO thật) cho kiểm thử tích hợp. */
export async function startApp() {
  process.env.MEDIA_CLEANUP_INTERVAL_SEC = '0'; // tắt job định kỳ trong test
  const env = loadApiEnv();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  app.useBodyParser('json', { limit: '15mb' });
  await app.init();
  const http = () => request(app.getHttpServer());
  return { app, env, http, prisma: app.get(PrismaService) };
}

export type Harness = Awaited<ReturnType<typeof startApp>>;

/** Upload 1 ảnh qua đúng luồng presigned (xin URL -> PUT lên MinIO -> complete). */
export async function uploadImage(
  h: Harness,
  file: { name: string; type: string; body: Buffer; declaredSize?: number },
) {
  const ticket = await h
    .http()
    .post('/media/uploads')
    .send({
      filename: file.name,
      contentType: file.type,
      size: file.declaredSize ?? file.body.length,
    });
  if (ticket.status !== 201) return { ticket, complete: undefined };
  const put = await fetch(ticket.body.uploadUrl, {
    method: 'PUT',
    headers: ticket.body.headers,
    body: new Uint8Array(file.body),
  });
  if (!put.ok) throw new Error(`PUT MinIO thất bại: ${put.status}`);
  const complete = await h.http().post(`/media/uploads/${ticket.body.uploadId}/complete`);
  return { ticket, complete };
}
