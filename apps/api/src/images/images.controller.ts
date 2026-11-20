import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import {
  AppError,
  IMAGE_MODES,
  IMAGE_MODE_META,
  IMAGE_PROVIDER_IDS,
  IMAGE_STYLES,
  type ImageProviderCheck,
  type ImageProvidersResponse,
  imageEstimateRequestSchema,
  imageGenerateRequestSchema,
  imageJobListQuerySchema,
  imageReviewSchema,
  nowUtcIso,
} from '@acs/shared';
import { ImageProviderRegistry } from '../ai/image/image-provider.registry';
import { IMAGE_TEMPLATES, matchTemplates } from '../ai/image/templates';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseId } from '../common/params';
import { parseInput } from '../common/validation';
import { SettingsService } from '../settings/settings.service';
import { ImageJobsService } from './image-jobs.service';

const checkSchema = z.object({ model: z.string().trim().min(1).max(100).optional() }).strict();
const templatesQuerySchema = z.object({
  mode: z
    .enum(IMAGE_MODES)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

/**
 * AI Image Studio – /images. Mọi route nhận workspace qua @WorkspaceId (không có route @Public).
 * Route tĩnh khai báo trước route có tham số.
 */
@Controller('images')
export class ImagesController {
  constructor(
    private readonly jobs: ImageJobsService,
    private readonly registry: ImageProviderRegistry,
    private readonly settings: SettingsService,
  ) {}

  /** Danh mục tĩnh: template, chế độ, phong cách. */
  @Get('templates')
  templates(@Query() query: unknown) {
    const { mode } = parseInput(templatesQuerySchema, query);
    return {
      templates: mode ? IMAGE_TEMPLATES.filter((t) => t.modes.includes(mode)) : IMAGE_TEMPLATES,
      modes: IMAGE_MODES.map((id) => ({ id, ...IMAGE_MODE_META[id] })),
      styles: IMAGE_STYLES,
    };
  }

  @Get('providers')
  async providers(@WorkspaceId() ws: string): Promise<ImageProvidersResponse> {
    const prefs = (await this.settings.get(ws)).preferences;
    return {
      defaultProvider: this.registry.resolveDefault(prefs.images.defaultProvider),
      providers: this.registry.all(),
    };
  }

  /** Kiểm tra credentials + model (không tạo ảnh, không tốn phí tạo ảnh). */
  @Post('providers/:id/check')
  @HttpCode(200)
  async check(@Param('id') id: string, @Body() body: unknown): Promise<ImageProviderCheck> {
    const providerId = parseInput(z.enum(IMAGE_PROVIDER_IDS), id);
    const { model } = parseInput(checkSchema, body ?? {});
    const p = this.registry.get(providerId);
    const chosen = model ?? this.registry.defaultModel(providerId);
    if (!p || !chosen) {
      return {
        id: providerId,
        ok: false,
        message: this.registry.status(providerId).message,
        model: chosen,
        checkedAt: nowUtcIso(),
      };
    }
    if (!this.registry.models(providerId).includes(chosen)) {
      throw new AppError('VALIDATION_ERROR', 'Model không nằm trong danh sách được phép');
    }
    const health = await p.validateConfiguration(chosen);
    return {
      id: providerId,
      ok: health.available,
      message: health.message ?? '',
      model: chosen,
      checkedAt: nowUtcIso(),
    };
  }

  /** Dữ kiện thị giác + ảnh tham chiếu + template phù hợp của 1 sản phẩm. */
  @Get('products/:productId/context')
  async context(
    @WorkspaceId() ws: string,
    @Param('productId') productId: string,
    @Query() query: unknown,
  ) {
    const { mode } = parseInput(templatesQuerySchema, query);
    const ctx = await this.jobs.productContext(ws, parseId(productId));
    return mode ? { ...ctx, templates: matchTemplates(ctx.visualContext, mode) } : ctx;
  }

  /** Ước tính chi phí + kiểm tra ngân sách + xem trước prompt. KHÔNG gọi AI. */
  @Post('estimate')
  @HttpCode(200)
  estimate(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.jobs.estimate(ws, parseInput(imageEstimateRequestSchema, body));
  }

  /** Tạo tác vụ (xếp hàng, xử lý nền). Gửi lại cùng idempotencyKey -> trả tác vụ cũ (200). */
  @Post('jobs')
  async create(
    @WorkspaceId() ws: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { job, created } = await this.jobs.create(
      ws,
      parseInput(imageGenerateRequestSchema, body),
    );
    res.status(created ? 201 : 200);
    return job;
  }

  @Get('jobs')
  list(@WorkspaceId() ws: string, @Query() query: unknown) {
    return this.jobs.list(ws, parseInput(imageJobListQuerySchema, query));
  }

  @Get('jobs/:id')
  detail(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.detail(ws, parseId(id));
  }

  /** Xoá tác vụ đã kết thúc (ảnh đã lưu thư viện/gắn sản phẩm được giữ lại). */
  @Delete('jobs/:id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.remove(ws, parseId(id));
  }

  @Post('jobs/:id/cancel')
  @HttpCode(200)
  cancel(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.cancel(ws, parseId(id));
  }

  @Post('items/:id/approve')
  @HttpCode(200)
  approve(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.jobs.review(ws, parseId(id), 'approved', parseInput(imageReviewSchema, body ?? {}));
  }

  @Post('items/:id/reject')
  @HttpCode(200)
  reject(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.jobs.review(ws, parseId(id), 'rejected', parseInput(imageReviewSchema, body ?? {}));
  }

  @Post('items/:id/regenerate')
  regenerate(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.regenerate(ws, parseId(id));
  }

  @Post('items/:id/save')
  @HttpCode(200)
  save(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.saveToLibrary(ws, parseId(id));
  }

  @Post('items/:id/link-product')
  @HttpCode(200)
  link(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.linkToProduct(ws, parseId(id));
  }

  /** URL tải xuống có hạn (presigned, 5 phút). */
  @Get('items/:id/download-url')
  download(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.jobs.downloadUrl(ws, parseId(id));
  }
}
