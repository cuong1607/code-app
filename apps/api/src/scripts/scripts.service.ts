import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, ScriptOrigin } from '@prisma/client';
import { z } from 'zod';
import {
  AppError,
  type ScriptDetail,
  type ScriptDocument,
  type ScriptIssue,
  type Script,
  lintScriptDocument,
  normalizeScriptDocument,
  scriptListQuerySchema,
  scriptManualCreateSchema,
  validationStatusOf,
} from '@acs/shared';
import { AiUsageService } from '../ai/ai-usage.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  type ScriptRowWithProduct,
  documentColumns,
  toScriptDto,
  toVersionSummary,
} from './script.mapper';

type ListQuery = z.output<typeof scriptListQuerySchema>;
type ManualCreate = z.output<typeof scriptManualCreateSchema>;

const withProduct = { product: { select: { name: true, sku: true } } } as const;

export interface NewVersionInput {
  document: ScriptDocument;
  issues: ScriptIssue[];
  origin: ScriptOrigin;
  changeNote: string;
  provider?: string | null;
  model?: string | null;
}

/**
 * Lưu trữ kịch bản & phiên bản (PostgreSQL). Mọi truy vấn lọc workspaceId.
 * Quy tắc phiên bản: sửa tay = cập nhật phiên bản đang mở; "lưu phiên bản mới" / tạo lại bằng AI
 * = tạo dòng MỚI (parent = phiên bản nguồn) -> phiên bản cũ không bao giờ bị ghi đè ngoài ý muốn.
 */
@Injectable()
export class ScriptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: AiUsageService,
  ) {}

  async findOwned(ws: string, id: string): Promise<ScriptRowWithProduct> {
    const row = await this.prisma.scriptDraft.findFirst({
      where: { id, workspaceId: ws },
      include: withProduct,
    });
    if (!row) throw new AppError('NOT_FOUND', 'Không tìm thấy kịch bản');
    return row;
  }

  private async latestNumbers(ws: string, rootIds: string[]): Promise<Map<string, number>> {
    if (!rootIds.length) return new Map();
    const rows = await this.prisma.scriptDraft.groupBy({
      by: ['rootId'],
      where: { workspaceId: ws, rootId: { in: rootIds } },
      _max: { versionNumber: true },
    });
    return new Map(rows.map((r) => [r.rootId!, r._max.versionNumber ?? 1]));
  }

  async toDtos(ws: string, rows: ScriptRowWithProduct[]): Promise<Script[]> {
    const [latest, usage] = await Promise.all([
      this.latestNumbers(ws, [...new Set(rows.map((r) => r.rootId ?? r.id))]),
      this.usage.byScripts(
        ws,
        rows.map((r) => r.id),
      ),
    ]);
    return rows.map((r) =>
      toScriptDto(r, latest.get(r.rootId ?? r.id) ?? r.versionNumber, usage.get(r.id)),
    );
  }

  /** Danh sách: mỗi kịch bản 1 dòng (phiên bản mới nhất). Lọc theo nhóm biến thể -> trả mọi biến thể. */
  async list(ws: string, q: ListQuery): Promise<Script[]> {
    const where: Prisma.ScriptDraftWhereInput = {
      workspaceId: ws,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.variantGroupId ? { variantGroupId: q.variantGroupId } : {}),
      ...(q.search ? { title: { contains: q.search, mode: 'insensitive' as const } } : {}),
    };
    const rows = await this.prisma.scriptDraft.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 2000,
      include: withProduct,
    });
    const heads = new Map<string, ScriptRowWithProduct>();
    for (const r of rows) {
      const key = q.variantGroupId ? r.id : (r.rootId ?? r.id);
      const cur = heads.get(key);
      if (!cur || r.versionNumber > cur.versionNumber) heads.set(key, r);
    }
    const list = [...heads.values()]
      .sort((a, b) =>
        q.variantGroupId
          ? (a.variantIndex ?? 0) - (b.variantIndex ?? 0)
          : b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, q.limit);
    return this.toDtos(ws, list);
  }

  async detail(ws: string, id: string): Promise<ScriptDetail> {
    const row = await this.findOwned(ws, id);
    const versions = await this.prisma.scriptDraft.findMany({
      where: { workspaceId: ws, rootId: row.rootId ?? row.id },
      orderBy: { versionNumber: 'desc' },
    });
    const [dto] = await this.toDtos(ws, [row]);
    return { ...dto!, versions: versions.map(toVersionSummary) };
  }

  private async assertProduct(ws: string, productId: string | null) {
    if (!productId) return;
    const found = await this.prisma.product.count({ where: { id: productId, workspaceId: ws } });
    if (!found) throw new AppError('NOT_FOUND', 'Không tìm thấy sản phẩm');
  }

  private checkManual(doc: ScriptDocument, includePrice: boolean) {
    const document = normalizeScriptDocument(doc);
    const issues = lintScriptDocument(document, { mode: 'manual', includePrice });
    return { document, issues, validationStatus: validationStatusOf(issues) };
  }

  /** Tạo kịch bản soạn tay / từ khuôn mẫu (không gọi AI). */
  async createManual(ws: string, input: ManualCreate): Promise<ScriptDetail> {
    await this.assertProduct(ws, input.productId);
    const { document, issues, validationStatus } = this.checkManual(
      input.document,
      Boolean(input.config.includePrice),
    );
    const id = randomUUID();
    await this.prisma.scriptDraft.create({
      data: {
        id,
        rootId: id,
        workspaceId: ws,
        productId: input.productId,
        versionNumber: 1,
        origin: input.origin,
        changeNote:
          input.origin === 'sample' ? 'Tạo từ khuôn mẫu (không phải AI)' : 'Soạn thủ công',
        templateId: input.templateId,
        ...documentColumns(document),
        issues: issues as unknown as Prisma.InputJsonValue,
        validationStatus,
        config: input.config,
      },
    });
    return this.detail(ws, id);
  }

  /** Sửa tay phiên bản đang mở (không gọi AI). */
  async update(
    ws: string,
    id: string,
    input: { document: ScriptDocument; changeNote?: string },
  ): Promise<ScriptDetail> {
    const row = await this.findOwned(ws, id);
    const { document, issues, validationStatus } = this.checkManual(
      input.document,
      Boolean((row.config as Record<string, unknown>).includePrice),
    );
    await this.prisma.scriptDraft.update({
      where: { id: row.id },
      data: {
        ...documentColumns(document),
        issues: issues as unknown as Prisma.InputJsonValue,
        validationStatus,
        changeNote:
          input.changeNote ?? (row.origin === 'ai' ? 'AI tạo, đã sửa thủ công' : row.changeNote),
      },
    });
    return this.detail(ws, id);
  }

  /** Tạo phiên bản mới từ phiên bản `parentId` (sửa tay hoặc kết quả AI tạo lại). */
  async createVersion(ws: string, parentId: string, v: NewVersionInput): Promise<ScriptDetail> {
    const parent = await this.findOwned(ws, parentId);
    const rootId = parent.rootId ?? parent.id;
    const document = normalizeScriptDocument(v.document);
    const id = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const max = await tx.scriptDraft.aggregate({
        where: { workspaceId: ws, rootId },
        _max: { versionNumber: true },
      });
      await tx.scriptDraft.create({
        data: {
          id,
          rootId,
          parentId: parent.id,
          workspaceId: ws,
          productId: parent.productId,
          versionNumber: (max._max.versionNumber ?? parent.versionNumber) + 1,
          origin: v.origin,
          changeNote: v.changeNote.slice(0, 200),
          templateId: parent.templateId,
          templateVersion: parent.templateVersion,
          provider: v.provider ?? null,
          model: v.model ?? null,
          ...documentColumns(document),
          issues: v.issues as unknown as Prisma.InputJsonValue,
          validationStatus: validationStatusOf(v.issues),
          variantGroupId: parent.variantGroupId,
          variantIndex: parent.variantIndex,
          angleId: parent.angleId,
          config: parent.config as Prisma.InputJsonValue,
        },
      });
    });
    return this.detail(ws, id);
  }

  async saveAsVersion(
    ws: string,
    parentId: string,
    input: { document: ScriptDocument; changeNote?: string },
  ): Promise<ScriptDetail> {
    const parent = await this.findOwned(ws, parentId);
    const { document, issues } = this.checkManual(
      input.document,
      Boolean((parent.config as Record<string, unknown>).includePrice),
    );
    return this.createVersion(ws, parentId, {
      document,
      issues,
      origin: 'manual',
      changeNote: input.changeNote ?? 'Lưu phiên bản mới (sửa thủ công)',
    });
  }

  /** Đánh dấu phiên bản tốt nhất trong nhóm biến thể. */
  async setPreferred(ws: string, id: string): Promise<ScriptDetail> {
    const row = await this.findOwned(ws, id);
    await this.prisma.$transaction([
      ...(row.variantGroupId
        ? [
            this.prisma.scriptDraft.updateMany({
              where: { workspaceId: ws, variantGroupId: row.variantGroupId },
              data: { isPreferred: false },
            }),
          ]
        : []),
      this.prisma.scriptDraft.update({ where: { id }, data: { isPreferred: true } }),
    ]);
    return this.detail(ws, id);
  }

  /** Xoá kịch bản (TẤT CẢ phiên bản cùng root). */
  async remove(ws: string, id: string): Promise<{ deleted: number }> {
    const row = await this.findOwned(ws, id);
    const { count } = await this.prisma.scriptDraft.deleteMany({
      where: { workspaceId: ws, rootId: row.rootId ?? row.id },
    });
    return { deleted: count };
  }
}
