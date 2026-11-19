import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { z } from 'zod';
import { IMPORT_MAX_FILE_BYTES, importRequestSchema } from '@acs/shared';
import { WorkspaceId } from '../auth/workspace.guard';
import { sendFile } from '../common/send-file';
import { parseInput } from '../common/validation';
import { ImportService, type UploadedSheet } from './import.service';

const formatSchema = z
  .enum(['csv', 'xlsx'], { error: 'format phải là csv hoặc xlsx' })
  .default('xlsx');

@Controller('products/import')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  /** Bước 1: upload file -> trả tiêu đề, các dòng và mapping gợi ý (CHƯA ghi gì). */
  @Post('preview')
  @HttpCode(200)
  // Không khai báo dest -> multer giữ file trong bộ nhớ (không ghi đĩa)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_FILE_BYTES, files: 1 } }),
  )
  preview(@UploadedFile() file: UploadedSheet | undefined) {
    return this.imports.preview(file);
  }

  /** Bước 2: kiểm tra từng dòng theo mapping & chế độ (CHƯA ghi gì). */
  @Post('validate')
  @HttpCode(200)
  validate(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.imports.run(ws, parseInput(importRequestSchema, body), false);
  }

  /** Bước 3: nhập các dòng hợp lệ. */
  @Post('commit')
  @HttpCode(200)
  commit(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.imports.run(ws, parseInput(importRequestSchema, body), true);
  }

  @Get('template')
  async template(@Query('format') format: unknown, @Res() res: Response) {
    sendFile(res, await this.imports.template(parseInput(formatSchema, format)));
  }
}
