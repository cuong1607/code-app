import { Module } from '@nestjs/common';
import { type ApiEnv } from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaUploadService } from './media-upload.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { RemoteImageFetcher } from './remote-image-fetcher';

@Module({
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaUploadService,
    MediaCleanupService,
    {
      provide: RemoteImageFetcher,
      inject: [APP_ENV],
      useFactory: (env: ApiEnv) =>
        new RemoteImageFetcher(
          env.IMPORT_IMAGE_ALLOWED_HOSTS,
          env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024,
        ),
    },
  ],
  exports: [MediaService, RemoteImageFetcher],
})
export class MediaModule {}
