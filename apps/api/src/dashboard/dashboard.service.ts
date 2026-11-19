import { Injectable } from '@nestjs/common';
import { type DashboardSummary, DEFAULT_DISPLAY_TIMEZONE } from '@acs/shared';
import { PrismaService } from '../prisma/prisma.service';

const DAYS = 14;

/** Số liệu tổng quan THẬT từ database của workspace. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(ws: string): Promise<DashboardSummary> {
    const [
      products,
      active,
      images,
      bytes,
      videoDrafts,
      publishing,
      scripts,
      batches,
      perDay,
      recent,
    ] = await Promise.all([
      this.prisma.product.count({ where: { workspaceId: ws } }),
      this.prisma.product.count({ where: { workspaceId: ws, status: 'active' } }),
      this.prisma.mediaAsset.count({
        where: { workspaceId: ws, assetType: { in: ['ORIGINAL_IMAGE', 'AI_IMAGE'] } },
      }),
      this.prisma.mediaAsset.aggregate({ where: { workspaceId: ws }, _sum: { fileSize: true } }),
      this.prisma.videoDraft.count({ where: { workspaceId: ws } }),
      this.prisma.publishingDraft.count({ where: { workspaceId: ws } }),
      this.prisma.scriptDraft.count({ where: { workspaceId: ws } }),
      this.prisma.videoDraft.findMany({
        where: { workspaceId: ws },
        distinct: ['batchKey'],
        select: { batchKey: true },
      }),
      // Nhóm theo NGÀY GIỜ VIỆT NAM (dữ liệu lưu UTC)
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(created_at AT TIME ZONE ${DEFAULT_DISPLAY_TIMEZONE}, 'YYYY-MM-DD') AS day, count(*) AS count
        FROM products
        WHERE workspace_id = ${ws}::uuid AND created_at >= now() - make_interval(days => ${DAYS}::int)
        GROUP BY day`,
      this.recentActivity(ws),
    ]);

    const counts = new Map(perDay.map((r) => [r.day, Number(r.count)]));
    const productsPerDay = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(Date.now() + 7 * 3600_000 - (DAYS - 1 - i) * 86_400_000)
        .toISOString()
        .slice(0, 10);
      return { date: d, count: counts.get(d) ?? 0 };
    });

    return {
      productCount: products,
      activeProductCount: active,
      imageCount: images,
      mediaBytes: Number(bytes._sum.fileSize ?? 0),
      videoCount: 0,
      videoDraftCount: videoDrafts,
      publishingDraftCount: publishing,
      scriptDraftCount: scripts,
      batchCount: batches.length,
      productsPerDay,
      recentActivity: recent,
    };
  }

  private async recentActivity(ws: string): Promise<DashboardSummary['recentActivity']> {
    const take = 5;
    const [products, media, videos, posts, scripts] = await Promise.all([
      this.prisma.product.findMany({
        where: { workspaceId: ws },
        orderBy: { updatedAt: 'desc' },
        take,
        select: { id: true, name: true, createdAt: true, updatedAt: true },
      }),
      this.prisma.mediaAsset.findMany({
        where: { workspaceId: ws },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, filename: true, createdAt: true },
      }),
      this.prisma.videoDraft.findMany({
        where: { workspaceId: ws },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.publishingDraft.findMany({
        where: { workspaceId: ws },
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, videoName: true, createdAt: true },
      }),
      this.prisma.scriptDraft.findMany({
        where: { workspaceId: ws },
        orderBy: { updatedAt: 'desc' },
        take,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);
    const items: DashboardSummary['recentActivity'] = [
      ...products.map((p) => ({
        id: `p-${p.id}`,
        kind: 'product' as const,
        message: `${p.updatedAt.getTime() - p.createdAt.getTime() > 1000 ? 'Cập nhật' : 'Thêm'} sản phẩm "${p.name}"`,
        at: p.updatedAt.toISOString(),
      })),
      ...media.map((m) => ({
        id: `m-${m.id}`,
        kind: 'media' as const,
        message: `Tải lên ảnh "${m.filename}"`,
        at: m.createdAt.toISOString(),
      })),
      ...videos.map((v) => ({
        id: `v-${v.id}`,
        kind: 'video_draft' as const,
        message: `Tạo luồng nháp "${v.name}"`,
        at: v.createdAt.toISOString(),
      })),
      ...posts.map((p) => ({
        id: `pd-${p.id}`,
        kind: 'publishing_draft' as const,
        message: `Tạo lịch đăng nháp cho "${p.videoName}"`,
        at: p.createdAt.toISOString(),
      })),
      ...scripts.map((s) => ({
        id: `s-${s.id}`,
        kind: 'script_draft' as const,
        message: `Lưu kịch bản nháp "${s.title}"`,
        at: s.updatedAt.toISOString(),
      })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }
}
