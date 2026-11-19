import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AppError,
  type Paginated,
  type Product,
  type ProductDetail,
  type ProductInput,
  type ProductListQuery,
  type ProductSourceType,
  type ProductUpdate,
  normalizeSearchText,
} from '@acs/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  buildProductSearchText,
  productDetailInclude,
  productListInclude,
  productWriteData,
  toProductDetailDto,
  toProductDto,
} from './product.mapper';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Điều kiện lọc dùng chung cho danh sách và xuất file. */
  buildWhere(
    workspaceId: string,
    q: Pick<ProductListQuery, 'search' | 'category' | 'status'>,
  ): Prisma.ProductWhereInput {
    return {
      workspaceId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: q.category } : {}),
      // search_text đã bỏ dấu + chữ thường; có index GIN pg_trgm cho LIKE '%...%'
      ...(q.search ? { searchText: { contains: normalizeSearchText(q.search) } } : {}),
    };
  }

  async list(workspaceId: string, q: ProductListQuery): Promise<Paginated<Product>> {
    const where = this.buildWhere(workspaceId, q);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: [{ [q.sortBy]: q.sortDir }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: productListInclude,
      }),
    ]);
    return {
      items: await Promise.all(rows.map((r) => toProductDto(r, this.storage))),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }

  /** Danh mục đang dùng (cho bộ lọc). */
  async categories(workspaceId: string): Promise<string[]> {
    const rows = await this.prisma.product.findMany({
      where: { workspaceId },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    return rows.map((r) => r.category);
  }

  async get(workspaceId: string, id: string): Promise<ProductDetail> {
    const row = await this.prisma.product.findFirst({
      where: { id, workspaceId },
      include: productDetailInclude,
    });
    if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
    return toProductDetailDto(row, this.storage);
  }

  async assertOwned(workspaceId: string, id: string): Promise<void> {
    const found = await this.prisma.product.count({ where: { id, workspaceId } });
    if (!found) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
  }

  async create(
    workspaceId: string,
    input: ProductInput,
    sourceType: ProductSourceType = 'manual',
  ): Promise<ProductDetail> {
    try {
      const row = await this.prisma.product.create({
        data: { ...productWriteData(input), workspaceId, sourceType },
        include: productDetailInclude,
      });
      return toProductDetailDto(row, this.storage);
    } catch (error) {
      throw this.mapConflict(error, input.sku);
    }
  }

  async update(workspaceId: string, id: string, patch: ProductUpdate): Promise<ProductDetail> {
    const current = await this.prisma.product.findFirst({ where: { id, workspaceId } });
    if (!current) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
    const merged = {
      name: patch.name ?? current.name,
      sku: patch.sku ?? current.sku,
      category: patch.category ?? current.category,
      brand: patch.brand !== undefined ? patch.brand : current.brand,
    };
    const data: Prisma.ProductUpdateInput = {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.sku !== undefined && { sku: patch.sku }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...('brand' in patch && { brand: patch.brand ?? null }),
      ...('description' in patch && { description: patch.description ?? null }),
      ...('costPrice' in patch && { costPrice: patch.costPrice ?? null }),
      ...(patch.sellingPrice !== undefined && { sellingPrice: patch.sellingPrice }),
      ...(patch.currency !== undefined && { currency: patch.currency }),
      ...(patch.attributes !== undefined && { attributes: patch.attributes }),
      ...('sourceUrl' in patch && { sourceUrl: patch.sourceUrl ?? null }),
      ...(patch.status !== undefined && { status: patch.status }),
      searchText: buildProductSearchText(merged),
    };
    try {
      const row = await this.prisma.product.update({
        where: { id },
        data,
        include: productDetailInclude,
      });
      return toProductDetailDto(row, this.storage);
    } catch (error) {
      throw this.mapConflict(error, merged.sku);
    }
  }

  /** Xoá sản phẩm. Ảnh trong thư viện được GIỮ LẠI (chỉ gỡ liên kết). */
  async remove(workspaceId: string, id: string): Promise<{ deleted: true }> {
    const { count } = await this.prisma.product.deleteMany({ where: { id, workspaceId } });
    if (!count) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
    return { deleted: true };
  }

  private mapConflict(error: unknown, sku: string): unknown {
    if (isUniqueViolation(error)) {
      return new AppError('CONFLICT', `SKU "${sku}" đã tồn tại trong workspace`, {
        field: 'sku',
        sku,
      });
    }
    return error;
  }
}
