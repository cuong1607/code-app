import { Module } from '@nestjs/common';
import {
  PromptPresetsController,
  PublishingDraftsController,
  ScriptDraftsController,
  VideoDraftsController,
} from './drafts.controller';
import { DraftsService } from './drafts.service';

@Module({
  controllers: [
    VideoDraftsController,
    PublishingDraftsController,
    ScriptDraftsController,
    PromptPresetsController,
  ],
  providers: [DraftsService],
})
export class DraftsModule {}
