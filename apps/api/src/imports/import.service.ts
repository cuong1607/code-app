import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ATTRIBUTE_FIELDS,
  AppError,
  IMPORT_FIELDS,
  IMPORT_MAX_FILE_BYTES,
  type ImportFieldKey,
  type ImportPreview,
  type ImportRequest,
  type ImportResult,
  type ImportRowResult,
  type ProductInput,
  type ProductListQuery,
  mapImportRow,
  suggestImportMapping,
} from '@acs/shared';
import { isUniqueViolation } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { buildProductSearchText, productWriteData } from '../products/product.mapper';
import { ProductsService } from '../products/products.service';
import { type SheetFormat, parseSpreadsheet, writeCsv, writeXlsx } from './spreadsheet';

export interface UploadedSheet {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/** Tiêu đề cột của file mẫu/xuất – khớp alias nên import lại được ngay. */
export const TEMPLATE_HEADERS = IMPORT_FIELDS.map((f) => f.label);
const EXPORT_LIMIT = 10_000;

interface PlannedRow {
  result: ImportRowResult;
  input?: ProductInput;
  imageUrls: string[];
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async preview(file: UploadedSheet | undefined): Promise<ImportPreview> {
    if (!file) throw new AppError('VALIDATION_ERROR', 'Chưa chọn file');
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      throw new AppError(
        'VALIDATION_ERROR',
        `File vượt quá ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB`,
      );
    }
    // Multer giải mã tên file theo latin1 -> đổi về UTF-8 để giữ tiếng Việt
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const sheet = await parseSpreadsheet(file.buffer, fileName);
    return {
      fileName,
      format: sheet.format,
      sheetName: sheet.sheetName,
      headers: sheet.headers,
      rows: sheet.rows,
      totalRows: sheet.rows.length,
      suggestedMapping: suggestImportMapping(sheet.headers),
    };
  }

  /** Kiểm tra (commit=false) hoặc nhập thật (commit=true). Cả 2 dùng CHUNG một logic. */
  async run(workspaceId: string, req: ImportRequest, commit: boolean): Promise<ImportResult> {
    const missing = IMPORT_FIELDS.filter(
      (f) => f.required && (req.mapping[f.key] ?? null) === null,
    );
    if (missing.length) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Chưa chọn cột cho: ${missing.map((f) => f.label).join(', ')}`,
      );
    }

    const planned: PlannedRow[] = [];
    const firstRowOfSku = new Map<string, number>();
    req.rows.forEach((cells, index) => {
      if (cells.every((c) => !c?.trim())) return;
      const rowNumber = index + 2; // dòng 1 là tiêu đề
      const mapped = mapImportRow(cells, req.mapping);
      const result: ImportRowResult = {
        rowNumber,
        sku: mapped.sku,
        name: mapped.name,
        action: 'create',
        errors: [...mapped.errors],
        imageUrlCount: mapped.imageUrls.length,
      };
      if (mapped.sku && !mapped.errors.length) {
        const first = firstRowOfSku.get(mapped.sku);
        if (first) result.errors.push(`SKU trùng với dòng ${first} trong cùng file`);
        else firstRowOfSku.set(mapped.sku, rowNumber);
      }
      if (result.errors.length || !mapped.input) result.action = 'error';
      planned.push({ result, input: mapped.input ?? undefined, imageUrls: mapped.imageUrls });
    });

    const candidateSkus = planned
      .filter((p) => p.result.action !== 'error')
      .map((p) => p.input!.sku);
    const existing = await this.prisma.product.findMany({
      where: { workspaceId, sku: { in: candidateSkus } },
      select: { id: true, sku: true, attributes: true, pendingImageUrls: true },
    });
    const existingBySku = new Map(existing.map((e) => [e.sku, e]));

    let abortedReason: string | null = null;
    for (const p of planned) {
      if (p.result.action === 'error' || !existingBySku.has(p.input!.sku)) continue;
      if (req.mode === 'skip_duplicates') {
        p.result.action = 'skip';
        p.result.errors.push('SKU đã tồn tại – bỏ qua');
      } else if (req.mode === 'update_duplicates') {
        p.result.action = 'update';
      } else {
        p.result.action = 'error';
        p.result.errors.push('SKU đã tồn tại (chế độ chỉ nhập sản phẩm mới)');
        abortedReason = 'Có SKU đã tồn tại – chế độ "Chỉ nhập sản phẩm mới" không nhập dòng nào.';
      }
    }

    const sourceType = req.format === 'xlsx' ? 'import_xlsx' : 'import_csv';
    const mapped = new Set(
      (Object.entries(req.mapping) as [ImportFieldKey, number | null][])
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k]) => k),
    );

    let committed = false;
    if (commit && !abortedReason) {
      await this.writeCreates(
        workspaceId,
        planned.filter((p) => p.result.action === 'create'),
        sourceType,
      );
      await this.writeUpdates(
        workspaceId,
        planned.filter((p) => p.result.action === 'update'),
        existingBySku,
        mapped,
      );
      committed = true;
    }

    const rows = planned.map((p) => p.result);
    const count = (a: ImportRowResult['action']) => rows.filter((r) => r.action === a).length;
    return {
      mode: req.mode,
      committed,
      abortedReason,
      summary: {
        total: rows.length,
        created: count('create'),
        updated: count('update'),
        skipped: count('skip'),
        failed: count('error'),
        imageUrls: rows
          .filter((r) => r.action === 'create' || r.action === 'update')
          .reduce((s, r) => s + r.imageUrlCount, 0),
      },
      rows,
    };
  }

  private async writeCreates(
    workspaceId: string,
    rows: PlannedRow[],
    sourceType: 'import_csv' | 'import_xlsx',
  ) {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const data = chunk.map((p) => ({
        ...productWriteData(p.input!),
        workspaceId,
        sourceType,
        pendingImageUrls: p.imageUrls,
      }));
      try {
        await this.prisma.product.createMany({ data });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        // Hiếm: SKU vừa được tạo bởi thao tác khác -> ghi từng dòng để biết dòng nào lỗi
        for (const [j, p] of chunk.entries()) {
          try {
            await this.prisma.product.create({ data: data[j]! });
          } catch (inner) {
            if (!isUniqueViolation(inner)) throw inner;
            p.result.action = 'error';
            p.result.errors.push('SKU vừa được tạo bởi thao tác khác');
          }
        }
      }
    }
  }

  /** Chỉ ghi đè cột ĐƯỢC MAP và CÓ GIÁ TRỊ – không xoá trắng dữ liệu cũ. */
  private async writeUpdates(
    workspaceId: string,
    rows: PlannedRow[],
    existing: Map<string, { id: string; attributes: Prisma.JsonValue; pendingImageUrls: string[] }>,
    mapped: Set<ImportFieldKey>,
  ) {
    for (let i = 0; i < rows.length; i += 100) {
      const ops = rows.slice(i, i + 100).map((p) => {
        const input = p.input!;
        const cur = existing.get(input.sku)!;
        const attrs = {
          ...((cur.attributes ?? {}) as Record<string, string>),
          ...input.attributes,
        };
        const data: Prisma.ProductUpdateInput = {
          name: input.name,
          category: input.category,
          sellingPrice: input.sellingPrice,
          searchText: buildProductSearchText(input),
          attributes: attrs,
          ...(mapped.has('brand') && input.brand !== undefined && { brand: input.brand }),
          ...(mapped.has('description') &&
            input.description !== undefined && { description: input.description }),
          ...(mapped.has('costPrice') &&
            input.costPrice !== null &&
            input.costPrice !== undefined && { costPrice: input.costPrice }),
          ...(mapped.has('sourceUrl') &&
            input.sourceUrl !== undefined && { sourceUrl: input.sourceUrl }),
          ...(mapped.has('status') && { status: input.status }),
          ...(p.imageUrls.length && {
            pendingImageUrls: [...new Set([...cur.pendingImageUrls, ...p.imageUrls])],
          }),
        };
        return this.prisma.product.update({ where: { id: cur.id }, data });
      });
      await this.prisma.$transaction(ops);
    }
  }

  async exportFile(
    workspaceId: string,
    q: Pick<ProductListQuery, 'search' | 'category' | 'status' | 'sortBy' | 'sortDir'>,
    format: SheetFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const rows = await this.prisma.product.findMany({
      where: this.products.buildWhere(workspaceId, q),
      orderBy: [{ [q.sortBy]: q.sortDir }, { id: 'asc' }],
      take: EXPORT_LIMIT,
      include: { _count: { select: { media: true } } },
    });
    const statusLabel = { draft: 'Bản nháp', active: 'Đang bán', archived: 'Lưu trữ' } as const;
    const headers = [...TEMPLATE_HEADERS, 'Số ảnh', 'Ngày tạo (UTC)'];
    const data = rows.map((r) => {
      const attrs = (r.attributes ?? {}) as Record<string, string>;
      const byKey: Record<ImportFieldKey, string | number | null> = {
        sku: r.sku,
        name: r.name,
        category: r.category,
        brand: r.brand,
        costPrice: r.costPrice ? Number(r.costPrice.toFixed(2)) : null,
        sellingPrice: Number(r.sellingPrice.toFixed(2)),
        description: r.description,
        color: attrs[ATTRIBUTE_FIELDS.color!] ?? null,
        size: attrs[ATTRIBUTE_FIELDS.size!] ?? null,
        material: attrs[ATTRIBUTE_FIELDS.material!] ?? null,
        sourceUrl: r.sourceUrl,
        imageUrls: r.pendingImageUrls.join(' '),
        status: statusLabel[r.status],
      };
      return [...IMPORT_FIELDS.map((f) => byKey[f.key]), r._count.media, r.createdAt.toISOString()];
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return this.file(headers, data, `san-pham-${stamp}`, format);
  }

  async template(format: SheetFormat) {
    const rows: (string | number | null)[][] = [
      [
        'VD-001',
        'Áo thun cotton (dòng VÍ DỤ – xoá trước khi import)',
        'Thời trang',
        'Thương hiệu A',
        90000,
        199000,
        'Chất liệu thoáng mát',
        'Trắng',
        'M',
        'Cotton 100%',
        'https://example.com/san-pham/ao-thun',
        '',
        'Bản nháp',
      ],
      [
        'VD-002',
        'Serum vitamin C 30ml (dòng VÍ DỤ)',
        'Mỹ phẩm',
        'Thương hiệu B',
        '150.000',
        '289.000',
        '',
        '',
        '30ml',
        '',
        '',
        '',
        'Đang bán',
      ],
    ];
    return this.file(TEMPLATE_HEADERS, rows, 'mau-import-san-pham', format);
  }

  private async file(
    headers: string[],
    rows: (string | number | null)[][],
    base: string,
    format: SheetFormat,
  ) {
    if (format === 'csv') {
      return {
        buffer: writeCsv(headers, rows),
        filename: `${base}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }
    return {
      buffer: await writeXlsx(headers, rows, 'Sản phẩm'),
      filename: `${base}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
