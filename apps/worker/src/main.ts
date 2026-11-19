import { hostname } from 'node:os';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { EnvValidationError, QUEUE_NAMES, nowUtcIso, toErrorMessage } from '@acs/shared';
import { loadWorkerEnv } from './env';
import { checkFfmpeg } from './ffmpeg';
import { writeHeartbeat } from './heartbeat';
import { createSystemProcessor } from './processors/system.processor';

const log = (level: 'info' | 'warn' | 'error', message: string) =>
  console[level === 'info' ? 'log' : level](
    `[worker] ${nowUtcIso()} ${level.toUpperCase()} ${message}`,
  );

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const workerId = `${hostname()}-${process.pid}`;
  const startedAt = nowUtcIso();

  const ffmpeg = await checkFfmpeg(env.FFMPEG_PATH);
  if (ffmpeg.available) log('info', `FFmpeg sẵn sàng (version ${ffmpeg.version})`);
  else log('warn', `FFmpeg chưa sẵn sàng: ${ffmpeg.error}`);

  const connection = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // bắt buộc với BullMQ Worker
    retryStrategy: (times: number) => Math.min(times * 500, 5000),
  };

  let lastRedisErrorAt = 0;
  const logRedisError = (error: unknown) => {
    const now = Date.now();
    if (now - lastRedisErrorAt > 30_000) {
      lastRedisErrorAt = now;
      log('warn', `Redis lỗi: ${toErrorMessage(error)} (đang thử kết nối lại...)`);
    }
  };

  const redis = new Redis(connection);
  redis.on('error', logRedisError);
  redis.on('ready', () => log('info', `Đã kết nối Redis ${env.REDIS_HOST}:${env.REDIS_PORT}`));

  const systemWorker = new Worker(QUEUE_NAMES.system, createSystemProcessor(workerId), {
    connection,
    prefix: env.QUEUE_PREFIX,
    concurrency: env.WORKER_CONCURRENCY,
  });
  systemWorker.on('error', logRedisError);
  systemWorker.on('completed', (job) => log('info', `Job ${job.name}#${job.id} hoàn tất`));
  systemWorker.on('failed', (job, error) =>
    log('error', `Job ${job?.name}#${job?.id} lỗi: ${toErrorMessage(error)}`),
  );

  const beat = () =>
    writeHeartbeat(
      redis,
      { workerId, pid: process.pid, startedAt, ffmpeg },
      env.WORKER_HEARTBEAT_INTERVAL_MS,
    ).catch((error: unknown) => logRedisError(error));
  void beat();
  const heartbeatTimer = setInterval(beat, env.WORKER_HEARTBEAT_INTERVAL_MS);

  log('info', `Worker ${workerId} đang lắng nghe hàng đợi "${QUEUE_NAMES.system}"`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('info', `Nhận ${signal}, đang dừng worker...`);
    clearInterval(heartbeatTimer);
    try {
      await systemWorker.close();
      await redis.quit();
    } catch (error) {
      log('error', `Lỗi khi dừng: ${toErrorMessage(error)}`);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

process.on('unhandledRejection', (reason) =>
  log('error', `unhandledRejection: ${toErrorMessage(reason)}`),
);

main().catch((error: unknown) => {
  if (error instanceof EnvValidationError) {
    console.error(`\n${error.message}\n\nHãy kiểm tra file .env (xem .env.example).\n`);
  } else {
    console.error('[worker] Không khởi động được:', error);
  }
  process.exit(1);
});
