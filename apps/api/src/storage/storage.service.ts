import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type ApiEnv, toErrorMessage } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';

/** Lớp truy cập object storage (MinIO / S3 compatible). Secrets chỉ ở server. */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  readonly client: S3Client;
  readonly bucket: string;
  private bucketReady = false;

  constructor(@Inject(APP_ENV) env: ApiEnv) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      maxAttempts: 1,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.warn(
        `Chưa kiểm tra/tạo được bucket "${this.bucket}": ${toErrorMessage(error)}. ` +
          'API vẫn chạy; /health sẽ báo storage down.',
      );
    }
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }

  /** Kiểm tra bucket tồn tại; nếu chưa có thì tạo. */
  async ensureBucket(): Promise<'exists' | 'created'> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.bucketReady = true;
      return 'exists';
    } catch (error) {
      const status = error instanceof S3ServiceException ? error.$metadata.httpStatusCode : 0;
      if (status !== 404) throw error;
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      // Một tiến trình khác vừa tạo xong -> coi như đã có
      if (!(error instanceof S3ServiceException && error.name === 'BucketAlreadyOwnedByYou')) {
        throw error;
      }
    }
    this.bucketReady = true;
    this.logger.log(`Đã tạo bucket "${this.bucket}"`);
    return 'created';
  }

  /**
   * Kiểm tra storage. Nếu bucket chưa được xác nhận (vd. MinIO lên sau API)
   * thì thử ensureBucket() thay vì chỉ báo lỗi 404.
   */
  async ping(signal?: AbortSignal): Promise<void> {
    if (!this.bucketReady) {
      await this.ensureBucket();
      return;
    }
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
      abortSignal: signal,
    });
  }
}
