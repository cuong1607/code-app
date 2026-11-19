import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type ApiEnv, AppError, toErrorMessage } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';

/** Lớp truy cập object storage (MinIO / S3 compatible). Secrets chỉ ở server. */
@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  readonly client: S3Client;
  /** Client chỉ dùng để KÝ URL cho trình duyệt (endpoint công khai có thể khác endpoint nội bộ). */
  private readonly publicClient: S3Client;
  readonly bucket: string;
  private bucketReady = false;

  constructor(@Inject(APP_ENV) env: ApiEnv) {
    this.bucket = env.S3_BUCKET;
    const base = {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      maxAttempts: 1,
    };
    this.client = new S3Client({ ...base, endpoint: env.S3_ENDPOINT });
    this.publicClient = new S3Client({
      ...base,
      endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT,
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
    this.publicClient.destroy();
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

  // ------------------------------------------------------------------ Object API (Phase 02)

  /** Chạy thao tác storage; lỗi mạng/không kết nối -> AppError SERVICE_UNAVAILABLE. */
  private async run<T>(label: string, op: () => Promise<T>): Promise<T> {
    try {
      if (!this.bucketReady) await this.ensureBucket();
      return await op();
    } catch (error) {
      if (error instanceof AppError) throw error;
      const status =
        error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
      if (status === undefined || status >= 500) {
        this.bucketReady = false; // lần sau thử lại ensureBucket (MinIO có thể vừa khởi động lại)
        throw new AppError('SERVICE_UNAVAILABLE', `Không kết nối được storage khi ${label}`, {
          reason: toErrorMessage(error),
        });
      }
      throw error;
    }
  }

  /** URL PUT có chữ ký để trình duyệt upload trực tiếp (Content-Type bị ràng buộc trong chữ ký). */
  presignPut(key: string, contentType: string, expiresInSec: number): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSec, signableHeaders: new Set(['content-type']) },
    );
  }

  /** URL GET có chữ ký (xem trước inline hoặc tải xuống với tên file). */
  presignGet(key: string, opts: { expiresInSec: number; downloadName?: string }): Promise<string> {
    const disposition = opts.downloadName
      ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
      : 'inline';
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: opts.expiresInSec },
    );
  }

  /** Thông tin object; null nếu không tồn tại. */
  head(key: string): Promise<{ size: number; contentType?: string; lastModified?: Date } | null> {
    return this.run('đọc thông tin file', async () => {
      try {
        const res = await this.client.send(
          new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return {
          size: res.ContentLength ?? 0,
          contentType: res.ContentType,
          lastModified: res.LastModified,
        };
      } catch (error) {
        const status =
          error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
        if (status === 404) return null;
        throw error;
      }
    });
  }

  /** Đọc toàn bộ object vào bộ nhớ, giới hạn `maxBytes` (chống file quá lớn). */
  getBuffer(key: string, maxBytes: number): Promise<Buffer> {
    return this.run('đọc file', async () => {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const body = res.Body as AsyncIterable<Uint8Array> | undefined;
      if (!body) throw new AppError('INTERNAL_ERROR', 'Storage trả về nội dung rỗng');
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of body) {
        total += chunk.length;
        if (total > maxBytes) {
          throw new AppError(
            'VALIDATION_ERROR',
            `File vượt quá ${Math.round(maxBytes / 1024 / 1024)} MB`,
          );
        }
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    });
  }

  putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.run('ghi file', async () => {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    });
  }

  /** Xoá object (không lỗi nếu không tồn tại). */
  deleteObject(key: string): Promise<void> {
    return this.run('xoá file', async () => {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    });
  }

  /** Liệt kê object theo tiền tố (dùng cho dọn dẹp object mồ côi). */
  async listObjects(prefix: string): Promise<{ key: string; size: number; lastModified?: Date }[]> {
    return this.run('liệt kê file', async () => {
      const out: { key: string; size: number; lastModified?: Date }[] = [];
      let token: string | undefined;
      do {
        const res = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const obj of res.Contents ?? []) {
          if (obj.Key)
            out.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified });
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return out;
    });
  }
}
