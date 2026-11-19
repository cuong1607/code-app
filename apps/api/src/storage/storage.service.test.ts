import { CreateBucketCommand, HeadBucketCommand, S3ServiceException } from '@aws-sdk/client-s3';
import { describe, expect, it, vi } from 'vitest';
import { type ApiEnv } from '@acs/shared';
import { StorageService } from './storage.service';

const env = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 's',
  S3_BUCKET: 'acs-media',
  S3_FORCE_PATH_STYLE: true,
} as ApiEnv;

const notFound = () =>
  new S3ServiceException({
    name: 'NotFound',
    $fault: 'client',
    $metadata: { httpStatusCode: 404 },
    message: '',
  });

describe('StorageService', () => {
  it('ping tự tạo bucket khi MinIO lên sau API (bucket chưa có)', async () => {
    const service = new StorageService(env);
    const send = vi
      .spyOn(service.client, 'send')
      .mockImplementationOnce(async () => {
        throw notFound();
      })
      .mockImplementation(async () => ({}));

    await service.ping();
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CreateBucketCommand);

    // Lần sau chỉ HeadBucket, không tạo lại
    await service.ping();
    expect(send).toHaveBeenCalledTimes(3);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(HeadBucketCommand);
    service.onModuleDestroy();
  });

  it('ping ném lỗi khi MinIO không kết nối được', async () => {
    const service = new StorageService(env);
    vi.spyOn(service.client, 'send').mockImplementation(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    await expect(service.ping()).rejects.toThrow('ECONNREFUSED');
    service.onModuleDestroy();
  });
});
