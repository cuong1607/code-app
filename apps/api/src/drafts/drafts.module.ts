import { Module } from '@nestjs/common';
import {
  PromptPresetsController,
  PublishingDraftsController,
  VideoDraftsController,
} from './drafts.controller';
import { SettingsModule } from '../settings/settings.module';
import { DraftsService } from './drafts.service';

@Module({
  imports: [SettingsModule],
  controllers: [VideoDraftsController, PublishingDraftsController, PromptPresetsController],
  providers: [DraftsService],
})
export class DraftsModule {}
