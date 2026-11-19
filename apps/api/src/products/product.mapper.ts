import type { Prisma } from '@prisma/client';
import {
  type Currency,
  type Product,
  type ProductDetail,
  type ProductInput,
  normalizeSearchText,
} from '@acs/shared';
import { toMediaDto } from '../media/media.mapper';
import type { StorageService } from '../storage/storage.service';

export const productListInclude = {
  media: { where: { isPrimary: true }, take: 1, include: { mediaAsset: true } },
  _count: { select: { media: true } },
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  media: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { mediaAsset: { include: { _count: { select: { products: true } } } } },
  },
  _count: { select: { media: true } },
} satisfies Prisma.ProductInclude;

type ListRow = Prisma.ProductGetPayload<{ include: typeof productListInclude }>;
type DetailRow = Prisma.ProductGetPayload<{ include: typeof productDetailInclude }>;

export function buildProductSearchText(p: {
  name: string;
  sku: string;
  category: string;
  brand?: string | null;
}) {
  return normalizeSearchText([p.name, p.sku, p.category, p.brand ?? ''].join(' '));
}

/** Dữ liệu ghi DB từ ProductInput (tiền giữ dạng number -> Prisma Decimal). */
export function productWriteData(input: ProductInput) {
  return {
    sku: input.sku,
    name: input.name,
    category: input.category,
    brand: input.brand ?? null,
    description: input.description ?? null,
    costPrice: input.costPrice ?? null,
    sellingPrice: input.sellingPrice,
    currency: input.currency,
    attributes: input.attributes,
    sourceUrl: input.sourceUrl ?? null,
    status: input.status,
    searchText: buildProductSearchText(input),
  };
}

async function base(row: ListRow | DetailRow, storage: StorageService): Promise<Product> {
  const primary = row.media.find((m) => m.isPrimary) ?? null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    brand: row.brand,
    description: row.description,
    costPrice: row.costPrice ? row.costPrice.toFixed(2) : null,
    sellingPrice: row.sellingPrice.toFixed(2),
    currency: row.currency as Currency,
    attributes: (row.attributes ?? {}) as Record<string, string>,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
    pendingImageUrls: row.pendingImageUrls,
    status: row.status,
    imageCount: row._count.media,
    primaryImage: primary ? await toMediaDto(primary.mediaAsset, storage) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProductDto(row: ListRow, storage: StorageService): Promise<Product> {
  return base(row, storage);
}

export async function toProductDetailDto(
  row: DetailRow,
  storage: StorageService,
): Promise<ProductDetail> {
  return {
    ...(await base(row, storage)),
    media: await Promise.all(
      row.media.map(async (m) => ({
        mediaAssetId: m.mediaAssetId,
        isPrimary: m.isPrimary,
        sortOrder: m.sortOrder,
        asset: await toMediaDto(m.mediaAsset, storage),
      })),
    ),
  };
}
