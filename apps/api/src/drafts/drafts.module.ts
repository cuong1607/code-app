import { Module } from '@nestjs/common';
import {
  PromptPresetsController,
  PublishingDraftsController,
  VideoDraftsController,
} from './drafts.controller';
import { DraftsService } from './drafts.service';

@Module({
  controllers: [VideoDraftsController, PublishingDraftsController, PromptPresetsController],
  providers: [DraftsService],
})
export class DraftsModule {}
