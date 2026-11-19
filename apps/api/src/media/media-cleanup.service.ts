import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type ApiEnv, toErrorMessage } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface CleanupReport {
  expiredUploads: number;
  orphanObjectsDeleted: number;
  scannedObjects: number;
}

/** Mặc định chỉ xoá object mồ côi cũ hơn 24 giờ (tránh đụng upload đang diễn ra). */
export const DEFAULT_ORPHAN_MIN_AGE_SEC = 24 * 3600;

/**
 * Dọn dẹp định kỳ:
 *  1. Phiên upload pending đã hết hạn -> xoá object (nếu có) + đánh dấu expired.
 *  2. Object mồ côi dưới tiền tố ws/ không thuộc MediaAsset hay phiên upload còn hiệu lực -> xoá.
 */
@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MediaCleanupService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  onModuleInit(): void {
    const sec = this.env.MEDIA_CLEANUP_INTERVAL_SEC;
    if (sec > 0 && this.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => void this.runSafely(), sec * 1000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async runSafely(): Promise<void> {
    try {
      const report = await this.run();
      if (report.expiredUploads || report.orphanObjectsDeleted) {
        this.logger.log(`Dọn dẹp media: ${JSON.stringify(report)}`);
      }
    } catch (error) {
      this.logger.warn(`Dọn dẹp media thất bại: ${toErrorMessage(error)}`);
    }
  }

  async run(orphanMinAgeSec = DEFAULT_ORPHAN_MIN_AGE_SEC): Promise<CleanupReport> {
    if (this.running) return { expiredUploads: 0, orphanObjectsDeleted: 0, scannedObjects: 0 };
    this.running = true;
    try {
      const now = new Date();
      const expired = await this.prisma.mediaUpload.findMany({
        where: { status: 'pending', expiresAt: { lt: now } },
        select: { id: true, storageKey: true },
        take: 500,
      });
      for (const up of expired) {
        await this.storage.deleteObject(up.storageKey);
        await this.prisma.mediaUpload.update({
          where: { id: up.id },
          data: { status: 'expired', failureReason: 'Hết hạn – không hoàn tất upload' },
        });
      }

      const objects = await this.storage.listObjects('ws/');
      const keys = objects.map((o) => o.key);
      const [assets, pending] = await Promise.all([
        this.prisma.mediaAsset.findMany({
          where: { storageKey: { in: keys } },
          select: { storageKey: true },
        }),
        this.prisma.mediaUpload.findMany({
          where: { storageKey: { in: keys }, status: 'pending', expiresAt: { gte: now } },
          select: { storageKey: true },
        }),
      ]);
      const keep = new Set([...assets, ...pending].map((r) => r.storageKey));
      const cutoff = now.getTime() - orphanMinAgeSec * 1000;
      let deleted = 0;
      for (const obj of objects) {
        if (keep.has(obj.key)) continue;
        if (obj.lastModified && obj.lastModified.getTime() > cutoff) continue;
        await this.storage.deleteObject(obj.key);
        deleted += 1;
      }
      return {
        expiredUploads: expired.length,
        orphanObjectsDeleted: deleted,
        scannedObjects: objects.length,
      };
    } finally {
      this.running = false;
    }
  }
}
