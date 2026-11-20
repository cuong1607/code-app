import { Module } from '@nestjs/common';
import { ImageProviderRegistry } from '../ai/image/image-provider.registry';
import { MediaModule } from '../media/media.module';
import { ProductsModule } from '../products/products.module';
import { ScriptsModule } from '../scripts/scripts.module';
import { SettingsModule } from '../settings/settings.module';
import { ImageItemProcessor } from './image-item.processor';
import { ImageJobsService } from './image-jobs.service';
import { ImageQueueService } from './image-queue.service';
import { ImagesController } from './images.controller';

/** AI Image Studio (Phase 04): API + hàng đợi ảnh + worker trong tiến trình API. */
@Module({
  // ScriptsModule export AiUsageService -> dùng chung ngân sách/usage với kịch bản
  imports: [SettingsModule, ScriptsModule, MediaModule, ProductsModule],
  controllers: [ImagesController],
  providers: [ImageProviderRegistry, ImageItemProcessor, ImageQueueService, ImageJobsService],
  exports: [ImageProviderRegistry, ImageJobsService],
})
export class ImagesModule {}
