import { Injectable } from '@nestjs/common';
import { AppError, type ProductDetail, normalizeSearchText } from '@acs/shared';
import { sanitizeFilename } from '../media/image-inspector';
import { buildImageKey } from '../media/media-upload.service';
import { RemoteImageFetcher } from '../media/remote-image-fetcher';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ProductsService } from './products.service';

/**
 * Ảnh của sản phẩm (bảng product_media).
 * Bất biến: mỗi sản phẩm có tối đa 1 ảnh đại diện; nếu còn ảnh thì luôn có 1 ảnh đại diện.
 */
@Injectable()
export class ProductMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly storage: StorageService,
    private readonly fetcher: RemoteImageFetcher,
  ) {}

  async attach(
    workspaceId: string,
    productId: string,
    mediaAssetIds: string[],
  ): Promise<ProductDetail> {
    await this.products.assertOwned(workspaceId, productId);
    const ids = [...new Set(mediaAssetIds)];
    const assets = await this.prisma.mediaAsset.findMany({
      where: { id: { in: ids }, workspaceId },
      select: { id: true, assetType: true },
    });
    if (assets.length !== ids.length)
      throw new AppError('NOT_FOUND', 'Một số ảnh không tồn tại trong workspace');
    if (
      assets.some((a) => !['ORIGINAL_IMAGE', 'AI_IMAGE', 'COMPOSED_IMAGE'].includes(a.assetType))
    ) {
      throw new AppError('VALIDATION_ERROR', 'Chỉ gắn được ảnh vào sản phẩm');
    }
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMedia.findMany({ where: { productId } });
      const have = new Set(existing.map((e) => e.mediaAssetId));
      let order = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1;
      let hasPrimary = existing.some((e) => e.isPrimary);
      for (const id of ids) {
        if (have.has(id)) continue;
        await tx.productMedia.create({
          data: { productId, mediaAssetId: id, sortOrder: order++, isPrimary: !hasPrimary },
        });
        hasPrimary = true;
      }
      await tx.product.update({ where: { id: productId }, data: { updatedAt: new Date() } });
    });
    return this.products.get(workspaceId, productId);
  }

  async detach(
    workspaceId: string,
    productId: string,
    mediaAssetId: string,
  ): Promise<ProductDetail> {
    await this.products.assertOwned(workspaceId, productId);
    await this.prisma.$transaction(async (tx) => {
      const link = await tx.productMedia.findUnique({
        where: { productId_mediaAssetId: { productId, mediaAssetId } },
      });
      if (!link) throw new AppError('NOT_FOUND', 'Ảnh không thuộc sản phẩm này');
      await tx.productMedia.delete({
        where: { productId_mediaAssetId: { productId, mediaAssetId } },
      });
      if (link.isPrimary) {
        const next = await tx.productMedia.findFirst({
          where: { productId },
          orderBy: { sortOrder: 'asc' },
        });
        if (next) {
          await tx.productMedia.update({
            where: { productId_mediaAssetId: { productId, mediaAssetId: next.mediaAssetId } },
            data: { isPrimary: true },
          });
        }
      }
    });
    return this.products.get(workspaceId, productId);
  }

  async setPrimary(
    workspaceId: string,
    productId: string,
    mediaAssetId: string,
  ): Promise<ProductDetail> {
    await this.products.assertOwned(workspaceId, productId);
    await this.prisma.$transaction(async (tx) => {
      const link = await tx.productMedia.findUnique({
        where: { productId_mediaAssetId: { productId, mediaAssetId } },
      });
      if (!link) throw new AppError('NOT_FOUND', 'Ảnh không thuộc sản phẩm này');
      await tx.productMedia.updateMany({ where: { productId }, data: { isPrimary: false } });
      await tx.productMedia.update({
        where: { productId_mediaAssetId: { productId, mediaAssetId } },
        data: { isPrimary: true },
      });
    });
    return this.products.get(workspaceId, productId);
  }

  async reorder(
    workspaceId: string,
    productId: string,
    orderedIds: string[],
  ): Promise<ProductDetail> {
    await this.products.assertOwned(workspaceId, productId);
    await this.prisma.$transaction(async (tx) => {
      const links = await tx.productMedia.findMany({
        where: { productId },
        select: { mediaAssetId: true },
      });
      const current = new Set(links.map((l) => l.mediaAssetId));
      const unique = new Set(orderedIds);
      if (
        unique.size !== orderedIds.length ||
        unique.size !== current.size ||
        orderedIds.some((id) => !current.has(id))
      ) {
        throw new AppError(
          'VALIDATION_ERROR',
          'Danh sách sắp xếp phải gồm đúng toàn bộ ảnh của sản phẩm',
        );
      }
      for (const [index, mediaAssetId] of orderedIds.entries()) {
        await tx.productMedia.update({
          where: { productId_mediaAssetId: { productId, mediaAssetId } },
          data: { sortOrder: index },
        });
      }
    });
    return this.products.get(workspaceId, productId);
  }

  /**
   * Tải 1 ảnh từ URL đã ghi nhận lúc import (pendingImageUrls) – CHỈ khi tên miền nằm trong
   * IMPORT_IMAGE_ALLOWED_HOSTS; có kiểm soát SSRF, redirect, dung lượng, loại file.
   */
  async importFromUrl(workspaceId: string, productId: string, url: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, workspaceId } });
    if (!product) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
    if (!product.pendingImageUrls.includes(url)) {
      throw new AppError(
        'VALIDATION_ERROR',
        'URL không nằm trong danh sách ảnh chờ tải của sản phẩm',
      );
    }
    const fetched = await this.fetcher.fetch(url);

    let asset = await this.prisma.mediaAsset.findUnique({
      where: { workspaceId_sha256: { workspaceId, sha256: fetched.sha256 } },
    });
    if (!asset) {
      const key = buildImageKey(workspaceId, fetched.extension);
      await this.storage.putObject(key, fetched.buffer, fetched.mimeType);
      const original = decodeURIComponent(
        new URL(fetched.finalUrl).pathname.split('/').pop() || 'anh',
      );
      const filename = sanitizeFilename(original, fetched.extension);
      asset = await this.prisma.mediaAsset.create({
        data: {
          workspaceId,
          filename,
          originalFilename: original.slice(0, 255),
          storageKey: key,
          bucket: this.storage.bucket,
          mimeType: fetched.mimeType,
          fileSize: BigInt(fetched.size),
          width: fetched.width,
          height: fetched.height,
          sha256: fetched.sha256,
          assetType: 'ORIGINAL_IMAGE',
          sourceType: 'import_url',
          sourceUrl: url,
          searchText: normalizeSearchText(filename),
        },
      });
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { pendingImageUrls: product.pendingImageUrls.filter((u) => u !== url) },
    });
    return this.attach(workspaceId, productId, [asset.id]);
  }
}
