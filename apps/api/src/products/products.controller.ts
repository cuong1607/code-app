import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import {
  attachMediaSchema,
  productInputSchema,
  productListQuerySchema,
  productUpdateSchema,
  reorderMediaSchema,
} from '@acs/shared';
import { WorkspaceId } from '../auth/workspace.guard';
import { parseId } from '../common/params';
import { sendFile } from '../common/send-file';
import { parseInput } from '../common/validation';
import { ImportService } from '../imports/import.service';
import { ProductMediaService } from './product-media.service';
import { ProductsService } from './products.service';

const exportQuerySchema = productListQuerySchema.extend({
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
});

@Controller('products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly productMedia: ProductMediaService,
    private readonly imports: ImportService,
  ) {}

  @Get()
  list(@WorkspaceId() ws: string, @Query() query: unknown) {
    return this.products.list(ws, parseInput(productListQuerySchema, query));
  }

  // Các route tĩnh phải khai báo TRƯỚC ':id'
  @Get('categories')
  categories(@WorkspaceId() ws: string) {
    return this.products.categories(ws);
  }

  @Get('export')
  async export(@WorkspaceId() ws: string, @Query() query: unknown, @Res() res: Response) {
    const q = parseInput(exportQuerySchema, query);
    sendFile(res, await this.imports.exportFile(ws, q, q.format));
  }

  @Get(':id')
  get(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.products.get(ws, parseId(id));
  }

  @Post()
  create(@WorkspaceId() ws: string, @Body() body: unknown) {
    return this.products.create(ws, parseInput(productInputSchema, body));
  }

  @Patch(':id')
  update(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.products.update(ws, parseId(id), parseInput(productUpdateSchema, body));
  }

  @Delete(':id')
  remove(@WorkspaceId() ws: string, @Param('id') id: string) {
    return this.products.remove(ws, parseId(id));
  }

  // ------------------------------------------------------------ Ảnh của sản phẩm
  @Post(':id/media')
  attach(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.productMedia.attach(
      ws,
      parseId(id),
      parseInput(attachMediaSchema, body).mediaAssetIds,
    );
  }

  @Put(':id/media/order')
  reorder(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    return this.productMedia.reorder(
      ws,
      parseId(id),
      parseInput(reorderMediaSchema, body).mediaAssetIds,
    );
  }

  @Put(':id/media/:mediaId/primary')
  setPrimary(
    @WorkspaceId() ws: string,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.productMedia.setPrimary(ws, parseId(id), parseId(mediaId, 'Mã ảnh'));
  }

  @Delete(':id/media/:mediaId')
  detach(@WorkspaceId() ws: string, @Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.productMedia.detach(ws, parseId(id), parseId(mediaId, 'Mã ảnh'));
  }

  /** Tải ảnh từ URL đã ghi nhận lúc import (cần IMPORT_IMAGE_ALLOWED_HOSTS). */
  @Post(':id/media/from-url')
  fromUrl(@WorkspaceId() ws: string, @Param('id') id: string, @Body() body: unknown) {
    const { url } = parseInput(z.object({ url: z.url('URL không hợp lệ') }), body);
    return this.productMedia.importFromUrl(ws, parseId(id), url);
  }
}
