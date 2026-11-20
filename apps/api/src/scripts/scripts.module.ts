import { Module } from '@nestjs/common';
import { AiUsageService } from '../ai/ai-usage.service';
import { ScriptProviderRegistry } from '../ai/script-provider.registry';
import { SettingsModule } from '../settings/settings.module';
import { ScriptGenerationService } from './script-generation.service';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';

@Module({
  imports: [SettingsModule],
  controllers: [ScriptsController],
  providers: [ScriptProviderRegistry, AiUsageService, ScriptsService, ScriptGenerationService],
  exports: [ScriptProviderRegistry, ScriptsService, AiUsageService],
})
export class ScriptsModule {}
