import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  type ScriptProvidersResponse,
  SCRIPT_PROVIDER_IDS,
  regenerateCaptionRequestSchema,
  regenerateSceneRequestSchema,
  scriptGenerateRequestSchema,
  scriptListQuerySchema,
  scriptManualCreateSchema,
  scriptUpdateSchema,
} from '@acs/shared';
import { AiUsageService } from '../ai/ai-usage.service';
import { ScriptProviderRegistry } from '../ai/script-provider.registry';
import { SCRIPT_TEMPLATES } from '../ai/script/templates';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseId } from '../common/params';
import { parseInput } from '../common/validation';
import { SettingsService } from '../settings/settings.service';
import { ScriptGenerationService } from './script-generation.service';
import { ScriptsService } from './scripts.service';

const checkSchema = z.object({ model: z.string().trim().min(1).max(100).optional() }).strict();

/**
 * AI Script Engine – /scripts (thay cho /drafts/scripts của Phase 02).
 * Route tĩnh (templates, providers, estimate, generate, usage) khai báo TRƯỚC ":id".
 */
@Controller('scripts')
export class ScriptsController {
  constructor(
    private readonly scripts: ScriptsService,
    private readonly generation: ScriptGenerationService,
    private readonly registry: ScriptProviderRegistry,
    private readonly usage: AiUsageService,
    private readonly settings: SettingsService,
  ) {}

  @Get('templates')
  templates() {
    return SCRIPT_TEMPLATES;
  }

  @Get('providers')
  async providers(@WorkspaceId() ws: string): Promise<ScriptProvidersResponse> {
    const prefs = (await this.settings.get(ws)).preferences;
    return {
      defaultProvider: this.registry.resolveDefault(prefs.ai.defaultProvider),
      providers: this.registry.all(),
    };
  }

  /** Kiểm tra credentials + model (Models API – không tốn token). */
  @Post('providers/:id/check')
  check(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    const provider = parseInput(z.enum(SCRIPT_PROVIDER_IDS), id);
    return this.generation.checkProvider(ws, provider, parseInput(checkSchema, body ?? {}).model);
  }

  @Get('usage/summary')
  async usageSummary(@WorkspaceId() ws: string) {
    const prefs = (await this.settings.get(ws)).preferences;
    return this.usage.summary(ws, prefs);
  }

  /** Dự tính chi phí + kiểm tra ngân sách, KHÔNG gọi AI. */
  @Post('estimate')
  estimate(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.generation.estimate(ws, parseInput(scriptGenerateRequestSchema, body));
  }

  /** Tạo kịch bản + biến thể bằng AI. Biến thể lỗi được báo riêng, biến thể thành công vẫn được lưu. */
  @Post('generate')
  generate(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.generation.generate(ws, parseInput(scriptGenerateRequestSchema, body));
  }

  @Get()
  list(@WorkspaceId() ws: string, @Query() query: unknown) {
    return this.scripts.list(ws, parseInput(scriptListQuerySchema, query));
  }

  /** Lưu kịch bản soạn tay / từ khuôn mẫu (không AI). */
  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.scripts.createManual(ws, parseInput(scriptManualCreateSchema, body));
  }

  @Get(':id')
  detail(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.scripts.detail(ws, parseId(id));
  }

  /** Sửa tay phiên bản đang mở (không gọi AI). */
  @Patch(':id')
  update(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.scripts.update(ws, parseId(id), parseInput(scriptUpdateSchema, body));
  }

  /** Lưu thành phiên bản mới (phiên bản hiện tại giữ nguyên). */
  @Post(':id/versions')
  saveVersion(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.scripts.saveAsVersion(ws, parseId(id), parseInput(scriptUpdateSchema, body));
  }

  @Post(':id/scenes/:index/regenerate')
  regenerateScene(
    @WorkspaceId() ws: string,
    @Param('id') id: string,
    @Param('index') index: string,
    @Body() body: unknown,
  ) {
    return this.generation.regenerateScene(
      ws,
      parseId(id),
      parseInput(z.coerce.number().int().min(1).max(30), index),
      parseInput(regenerateSceneRequestSchema, body ?? {}),
    );
  }

  @Post(':id/caption/regenerate')
  regenerateCaption(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.generation.regenerateCaption(
      ws,
      parseId(id),
      parseInput(regenerateCaptionRequestSchema, body ?? {}),
    );
  }

  @Put(':id/preferred')
  preferred(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.scripts.setPreferred(ws, parseId(id));
  }

  /** Xoá kịch bản cùng TOÀN BỘ phiên bản. */
  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.scripts.remove(ws, parseId(id));
  }
}
