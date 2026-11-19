import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  type ApiEnv,
  AppError,
  QUEUE_NAMES,
  SYSTEM_JOBS,
  type SystemPingPayload,
  type SystemPingResult,
  nowUtcIso,
  toErrorMessage,
} from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { withTimeout } from '../common/with-timeout';
import { RedisService, buildRedisOptions } from '../redis/redis.service';

const QUEUE_OP_TIMEOUT_MS = 5000;

export interface PingJobStatus {
  jobId: string;
  state: string;
  result?: SystemPingResult;
  failedReason?: string;
}

/** Producer BullMQ phía API. Worker (apps/worker) là consumer. */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private lastErrorLogAt = 0;
  readonly systemQueue: Queue<SystemPingPayload, SystemPingResult>;

  constructor(
    @Inject(APP_ENV) env: ApiEnv,
    private readonly redis: RedisService,
  ) {
    this.systemQueue = new Queue(QUEUE_NAMES.system, {
      prefix: env.QUEUE_PREFIX,
      connection: { ...buildRedisOptions(env), maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
    this.systemQueue.on('error', (error) => {
      const now = Date.now();
      if (now - this.lastErrorLogAt > 30_000) {
        this.lastErrorLogAt = now;
        this.logger.warn(`Queue "${QUEUE_NAMES.system}" lỗi: ${toErrorMessage(error)}`);
      }
    });
  }

  /**
   * BullMQ dùng maxRetriesPerRequest=null nên lệnh sẽ CHỜ VÔ HẠN khi Redis down.
   * Vì vậy: kiểm tra kết nối trước (fail-fast) và luôn đặt timeout.
   */
  private async run<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const { status } = this.redis.client;
    if (status !== 'ready') {
      throw new AppError('SERVICE_UNAVAILABLE', 'Hàng đợi chưa sẵn sàng: chưa kết nối Redis', {
        redisStatus: status,
      });
    }
    try {
      return await withTimeout(operation(), QUEUE_OP_TIMEOUT_MS, label);
    } catch (error) {
      throw new AppError('SERVICE_UNAVAILABLE', `${label} thất bại`, {
        reason: toErrorMessage(error),
      });
    }
  }

  async enqueuePing(note?: string): Promise<{ jobId: string }> {
    const job = await this.run('Đưa job vào hàng đợi', () =>
      this.systemQueue.add(SYSTEM_JOBS.ping, { requestedAt: nowUtcIso(), note }),
    );
    if (!job.id) throw new AppError('INTERNAL_ERROR', 'BullMQ không trả về job id');
    return { jobId: job.id };
  }

  async getPingStatus(jobId: string): Promise<PingJobStatus> {
    const job = await this.run('Đọc job', () => this.systemQueue.getJob(jobId));
    if (!job) throw new AppError('NOT_FOUND', `Không tìm thấy job ${jobId}`);
    const state = await this.run('Đọc trạng thái job', () => job.getState());
    return {
      jobId,
      state,
      ...(job.returnvalue ? { result: job.returnvalue } : {}),
      ...(job.failedReason ? { failedReason: job.failedReason } : {}),
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.systemQueue.close().catch(() => undefined);
  }
}
