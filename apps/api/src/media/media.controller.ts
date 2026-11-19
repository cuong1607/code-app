import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { createUploadSchema, mediaListQuerySchema } from '@acs/shared';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseBool, parseId } from '../common/params';
import { parseInput } from '../common/validation';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaUploadService } from './media-upload.service';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly uploads: MediaUploadService,
    private readonly cleanup: MediaCleanupService,
  ) {}

  @Get()
  list(@WorkspaceId() ws: string, @Query() query: unknown) {
    return this.media.list(ws, parseInput(mediaListQuerySchema, query));
  }

  /** Bước 1: xin URL upload (server kiểm tra loại & dung lượng khai báo). */
  @Post('uploads')
  createUpload(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.uploads.createTicket(ws, parseInput(createUploadSchema, body));
  }

  /** Bước 3: server xác minh object thật rồi mới tạo MediaAsset. */
  @Post('uploads/:id/complete')
  @HttpCode(200)
  completeUpload(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.uploads.complete(ws, parseId(id, 'Mã phiên upload'));
  }

  /** Chạy dọn dẹp thủ công (dev). orphanMinAgeSec mặc định 24h. */
  @Post('maintenance/cleanup')
  @HttpCode(200)
  runCleanup(@Query('orphanMinAgeSec') minAge?: string) {
    const age =
      minAge === undefined ? undefined : parseInput(z.coerce.number().int().min(0), minAge);
    return this.cleanup.run(age);
  }

  @Get(':id')
  get(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.media.get(ws, parseId(id));
  }

  @Get(':id/download-url')
  downloadUrl(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.media.downloadUrl(ws, parseId(id));
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string, @Query('force') force?: string) {
    return this.media.remove(ws, parseId(id), parseBool(force));
  }
}
