import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { type Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import {
  type ApiEnv,
  AppError,
  IMAGE_JOBS,
  type ImageGenerateItemPayload,
  QUEUE_NAMES,
  imageGenerateItemPayloadSchema,
  imageQueueJobId,
  toErrorMessage,
} from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { withTimeout } from '../common/with-timeout';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService, buildRedisOptions } from '../redis/redis.service';
import { ImageItemProcessor, PermanentImageError } from './image-item.processor';

const QUEUE_OP_TIMEOUT_MS = 5000;
const RECONCILE_INTERVAL_MS = 60_000;

/**
 * Hàng đợi ảnh (BullMQ, Redis có sẵn). Consumer chạy TRONG tiến trình API để dùng lại Prisma,
 * StorageService, AiUsage và ImageProviderRegistry (xem ARCHITECTURE – bảng quyết định).
 *  - Mỗi ảnh = 1 job, jobId cố định theo item -> thêm lại không tạo trùng.
 *  - concurrency = IMAGE_WORKER_CONCURRENCY; số lần chạy = IMAGE_MAX_ATTEMPTS, backoff mũ.
 *  - Khôi phục: khi khởi động và mỗi phút, item còn QUEUED/RUNNING trong DB mà không có job
 *    đang chờ/chạy trong Redis sẽ được đưa lại vào hàng đợi (vd API tắt giữa chừng, Redis mất dữ liệu).
 */
@Injectable()
export class ImageQueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ImageQueueService.name);
  readonly queue: Queue<ImageGenerateItemPayload>;
  private worker?: Worker<ImageGenerateItemPayload>;
  private reconcileTimer?: NodeJS.Timeout;
  private lastErrorLogAt = 0;

  constructor(
    @Inject(APP_ENV) private readonly env: ApiEnv,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly processor: ImageItemProcessor,
  ) {
    this.queue = new Queue(QUEUE_NAMES.image, {
      prefix: env.QUEUE_PREFIX,
      connection: { ...buildRedisOptions(env), maxRetriesPerRequest: null },
      defaultJobOptions: {
        attempts: env.IMAGE_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 2000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
    this.queue.on('error', (e) => this.logThrottled(`Queue ảnh lỗi: ${toErrorMessage(e)}`));
  }

  private logThrottled(message: string) {
    const now = Date.now();
    if (now - this.lastErrorLogAt > 30_000) {
      this.lastErrorLogAt = now;
      this.logger.warn(message);
    }
  }

  onApplicationBootstrap(): void {
    if (!this.env.IMAGE_WORKER_ENABLED) {
      this.logger.log('IMAGE_WORKER_ENABLED=false – API chỉ nhận job ảnh, không xử lý');
      return;
    }
    this.startWorker();
    void this.reconcile().catch((e) =>
      this.logThrottled(`Khôi phục job ảnh lỗi: ${toErrorMessage(e)}`),
    );
    this.reconcileTimer = setInterval(
      () =>
        void this.reconcile().catch((e) =>
          this.logThrottled(`Khôi phục job ảnh lỗi: ${toErrorMessage(e)}`),
        ),
      RECONCILE_INTERVAL_MS,
    );
    this.reconcileTimer.unref();
  }

  /** Bắt đầu consumer (test có thể gọi trực tiếp). */
  startWorker(): Worker<ImageGenerateItemPayload> {
    if (this.worker) return this.worker;
    this.worker = new Worker<ImageGenerateItemPayload>(
      QUEUE_NAMES.image,
      (job) => this.handle(job),
      {
        prefix: this.env.QUEUE_PREFIX,
        connection: { ...buildRedisOptions(this.env), maxRetriesPerRequest: null },
        concurrency: this.env.IMAGE_WORKER_CONCURRENCY,
        // Khoá đủ dài cho 1 lời gọi provider; quá hạn (tiến trình chết) -> BullMQ coi là stalled và chạy lại
        lockDuration: this.env.IMAGE_REQUEST_TIMEOUT_MS + 60_000,
        maxStalledCount: 1,
      },
    );
    this.worker.on('error', (e) => this.logThrottled(`Worker ảnh lỗi: ${toErrorMessage(e)}`));
    this.worker.on('failed', (job, e) =>
      this.logger.warn(
        `Job ảnh ${job?.id} thất bại lần ${job?.attemptsMade}: ${toErrorMessage(e)}`,
      ),
    );
    this.logger.log(
      `Worker ảnh đang chạy (concurrency ${this.env.IMAGE_WORKER_CONCURRENCY}, tối đa ${this.env.IMAGE_MAX_ATTEMPTS} lần/ảnh)`,
    );
    return this.worker;
  }

  async stopWorker(): Promise<void> {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    await this.worker?.close().catch(() => undefined);
    this.worker = undefined;
  }

  private async handle(job: Job<ImageGenerateItemPayload>): Promise<string> {
    const parsed = imageGenerateItemPayloadSchema.safeParse(job.data);
    if (!parsed.success) throw new UnrecoverableError('Payload job ảnh không hợp lệ');
    try {
      const outcome = await this.processor.process(parsed.data, {
        attemptsMade: job.attemptsMade,
        maxAttempts: this.env.IMAGE_MAX_ATTEMPTS,
      });
      // 'retry' -> ném lỗi để BullMQ thử lại theo backoff; các kết quả khác đã ghi vào DB
      if (outcome === 'retry') throw new Error('Lỗi tạm thời – BullMQ sẽ thử lại');
      return outcome;
    } catch (error) {
      if (error instanceof PermanentImageError) throw new UnrecoverableError(error.message);
      throw error;
    }
  }

  /** Redis chưa sẵn sàng -> báo lỗi ngay (BullMQ sẽ chờ vô hạn nếu không kiểm tra). */
  private async run<T>(label: string, op: () => Promise<T>): Promise<T> {
    if (this.redis.client.status !== 'ready') {
      throw new AppError('SERVICE_UNAVAILABLE', 'Hàng đợi chưa sẵn sàng: chưa kết nối Redis');
    }
    try {
      return await withTimeout(op(), QUEUE_OP_TIMEOUT_MS, label);
    } catch (error) {
      throw new AppError('SERVICE_UNAVAILABLE', `${label} thất bại`, {
        reason: toErrorMessage(error),
      });
    }
  }

  /** Đưa item vào hàng đợi. Job cũ đã xong/lỗi cùng ID bị xoá trước để thêm lại được. */
  async enqueue(items: ImageGenerateItemPayload[]): Promise<void> {
    await this.run('Đưa ảnh vào hàng đợi', async () => {
      for (const p of items) {
        const id = imageQueueJobId(p.itemId);
        const existing = await this.queue.getJob(id);
        if (existing) {
          const state = await existing.getState();
          if (
            state === 'active' ||
            state === 'waiting' ||
            state === 'delayed' ||
            state === 'prioritized' ||
            state === 'waiting-children'
          )
            continue;
          await existing.remove().catch(() => undefined);
        }
        await this.queue.add(IMAGE_JOBS.generateItem, p, { jobId: id });
      }
    });
  }

  /** Gỡ job chưa chạy khỏi hàng đợi (job đang chạy sẽ tự bỏ kết quả khi thấy tác vụ đã huỷ). */
  async removePending(itemIds: string[]): Promise<void> {
    await this.run('Gỡ ảnh khỏi hàng đợi', async () => {
      for (const itemId of itemIds) {
        const job = await this.queue.getJob(imageQueueJobId(itemId));
        if (!job) continue;
        const state = await job.getState();
        if (state !== 'active') await job.remove().catch(() => undefined);
      }
    });
  }

  /** Khôi phục item bị bỏ dở (restart API, mất job trong Redis). Trả số item được đưa lại. */
  async reconcile(): Promise<number> {
    if (this.redis.client.status !== 'ready') return 0;
    const stuck = await this.prisma.imageGenerationItem.findMany({
      where: {
        status: { in: ['QUEUED', 'RUNNING', 'WAITING_PROVIDER'] },
        job: { status: { not: 'CANCELLED' } },
      },
      select: { id: true, jobId: true, workspaceId: true, status: true },
      take: 500,
    });
    const requeue: ImageGenerateItemPayload[] = [];
    for (const it of stuck) {
      const job = await this.queue.getJob(imageQueueJobId(it.id));
      const state = job ? await job.getState() : 'missing';
      if (['waiting', 'active', 'delayed', 'prioritized', 'waiting-children'].includes(state))
        continue;
      if (it.status !== 'QUEUED') {
        // Đang chạy dở khi tiến trình dừng: đặt lại QUEUED (số lần đã chạy vẫn được tính)
        await this.prisma.imageGenerationItem.update({
          where: { id: it.id },
          data: {
            status: 'QUEUED',
            stage: 'queued',
            errorMessage: 'Khôi phục sau khi tiến trình xử lý dừng giữa chừng',
          },
        });
      }
      requeue.push({ workspaceId: it.workspaceId, jobId: it.jobId, itemId: it.id });
    }
    if (requeue.length) {
      await this.enqueue(requeue);
      this.logger.log(`Đã khôi phục ${requeue.length} ảnh vào hàng đợi`);
    }
    return requeue.length;
  }

  async onModuleDestroy(): Promise<void> {
    await this.stopWorker();
    await this.queue.close().catch(() => undefined);
  }
}
