import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  type AiUsageRecord,
  type AiUsageSummary,
  type ApiEnv,
  AppError,
  type AppPreferences,
} from '@acs/shared';
import { APP_ENV } from '../config/app-config.module';
import { PrismaService } from '../prisma/prisma.service';
import { costUsd, priceFor, usd } from './pricing';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** 00:00 hôm nay theo giờ Việt Nam, biểu diễn ở UTC. */
export function startOfVnDay(now = new Date()): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS);
}
export function startOfVnMonth(now = new Date()): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1) - VN_OFFSET_MS);
}

export interface UsageInput {
  provider: string;
  model: string;
  feature:
    | 'script_generate'
    | 'scene_regenerate'
    | 'caption_generate'
    | 'provider_check'
    | 'image_generate';
  status: 'success' | 'failed' | 'invalid_output' | 'refused' | 'rejected_budget';
  generationId?: string | null;
  scriptDraftId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  latencyMs?: number | null;
  errorCode?: string | null;
  /** Ảnh: chi phí ước tính theo đơn giá/ảnh (không tính từ token) */
  estimatedCostUsd?: number | null;
  imageJobId?: string | null;
  imageItemId?: string | null;
  imagesRequested?: number | null;
  imagesSucceeded?: number | null;
}

export interface BudgetDecision {
  allowed: boolean;
  reason: string | null;
  remainingDailyUsd: number;
  remainingMonthlyUsd: number | null;
}

/**
 * Ghi nhận sử dụng AI + kiểm soát ngân sách.
 * - Chi phí = ƯỚC TÍNH (token × đơn giá cấu hình); actualCostUsd để trống vì provider không trả chi phí thật.
 * - Ngân sách: theo lần tạo, theo ngày (giờ VN), theo tháng (nếu bật "dừng khi vượt ngân sách").
 * - Có "giữ chỗ" chi phí cho các lệnh đang chạy để nhiều request song song không vượt ngân sách.
 */
@Injectable()
export class AiUsageService {
  private readonly reserved = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: ApiEnv,
  ) {}

  estimateCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number | null {
    const price = priceFor(provider, model, this.env);
    return price ? costUsd(price, inputTokens, outputTokens) : null;
  }

  async record(ws: string, u: UsageInput): Promise<string> {
    const cost =
      u.estimatedCostUsd !== undefined
        ? u.estimatedCostUsd
        : (u.inputTokens !== null && u.inputTokens !== undefined) ||
            (u.outputTokens !== null && u.outputTokens !== undefined)
          ? this.estimateCost(u.provider, u.model, u.inputTokens ?? 0, u.outputTokens ?? 0)
          : null;
    const row = await this.prisma.aiUsage.create({
      data: {
        workspaceId: ws,
        provider: u.provider,
        model: u.model.slice(0, 100),
        feature: u.feature,
        status: u.status,
        generationId: u.generationId ?? null,
        scriptDraftId: u.scriptDraftId ?? null,
        inputTokens: u.inputTokens ?? null,
        outputTokens: u.outputTokens ?? null,
        estimatedCostUsd: cost === null ? null : new Prisma.Decimal(usd(cost)),
        latencyMs: u.latencyMs ?? null,
        errorCode: u.errorCode?.slice(0, 60) ?? null,
        imageJobId: u.imageJobId ?? null,
        imageItemId: u.imageItemId ?? null,
        imagesRequested: u.imagesRequested ?? null,
        imagesSucceeded: u.imagesSucceeded ?? null,
      },
    });
    return row.id;
  }

  /** Gắn các bản ghi usage của một lần tạo vào kịch bản đã lưu. */
  async linkToScript(ws: string, ids: string[], scriptDraftId: string) {
    if (!ids.length) return;
    await this.prisma.aiUsage.updateMany({
      where: { id: { in: ids }, workspaceId: ws },
      data: { scriptDraftId },
    });
  }

  private async spentSince(ws: string, since: Date): Promise<{ cost: number; calls: number }> {
    const agg = await this.prisma.aiUsage.aggregate({
      where: { workspaceId: ws, createdAt: { gte: since }, status: { not: 'rejected_budget' } },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    });
    return { cost: Number(agg._sum.estimatedCostUsd ?? 0), calls: agg._count._all };
  }

  /**
   * Chi phí ước tính của ảnh đã xếp hàng nhưng CHƯA gọi provider (đọc từ DB -> đúng cả sau khi restart).
   * Item đang chạy đã/đang được ghi ai_usage nên chỉ tính QUEUED.
   */
  async pendingImageCost(ws: string): Promise<number> {
    const agg = await this.prisma.imageGenerationItem.aggregate({
      where: { workspaceId: ws, status: 'QUEUED' },
      _sum: { estimatedCostUsd: true },
    });
    return Number(agg._sum.estimatedCostUsd ?? 0);
  }

  /** Kiểm tra trước khi gọi AI. estimate = null nghĩa là không đủ thông tin để dự tính an toàn. */
  async checkBudget(
    ws: string,
    prefs: AppPreferences,
    estimate: number | null,
    opts: { extraPendingUsd?: number } = {},
  ): Promise<BudgetDecision> {
    const [day, month] = await Promise.all([
      this.spentSince(ws, startOfVnDay()),
      this.spentSince(ws, startOfVnMonth()),
    ]);
    const pending = (this.reserved.get(ws) ?? 0) + (opts.extraPendingUsd ?? 0);
    const remainingDailyUsd = Math.max(0, prefs.ai.dailyBudgetUsd - day.cost - pending);
    const remainingMonthlyUsd = prefs.cost.hardStop
      ? Math.max(0, prefs.cost.monthlyBudgetUsd - month.cost - pending)
      : null;
    const base = { remainingDailyUsd, remainingMonthlyUsd };
    if (estimate === null)
      return {
        ...base,
        allowed: false,
        reason:
          'Không có đơn giá cho model này nên không thể dự tính chi phí an toàn – cấu hình đơn giá ở server hoặc chọn model khác',
      };
    if (estimate > prefs.ai.perGenerationBudgetUsd)
      return {
        ...base,
        allowed: false,
        reason: `Chi phí ước tính $${estimate.toFixed(4)} vượt ngân sách mỗi lần tạo $${prefs.ai.perGenerationBudgetUsd} – giảm số phiên bản hoặc tăng ngân sách`,
      };
    if (estimate > remainingDailyUsd)
      return {
        ...base,
        allowed: false,
        reason: `Vượt ngân sách ngày: còn $${remainingDailyUsd.toFixed(4)}, cần ~$${estimate.toFixed(4)}`,
      };
    if (remainingMonthlyUsd !== null && estimate > remainingMonthlyUsd)
      return {
        ...base,
        allowed: false,
        reason: `Vượt ngân sách tháng: còn $${remainingMonthlyUsd.toFixed(4)}, cần ~$${estimate.toFixed(4)}`,
      };
    return { ...base, allowed: true, reason: null };
  }

  /** Giữ chỗ ngân sách cho lệnh đang chạy; gọi hàm trả về để giải phóng. */
  async reserve(ws: string, prefs: AppPreferences, estimate: number | null): Promise<() => void> {
    const decision = await this.checkBudget(ws, prefs, estimate);
    if (!decision.allowed) throw new AppError('BUDGET_EXCEEDED', decision.reason!, decision);
    const amount = estimate ?? 0;
    this.reserved.set(ws, (this.reserved.get(ws) ?? 0) + amount);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.reserved.set(ws, Math.max(0, (this.reserved.get(ws) ?? 0) - amount));
    };
  }

  async summary(ws: string, prefs: AppPreferences): Promise<AiUsageSummary> {
    const [day, month, recent] = await Promise.all([
      this.spentSince(ws, startOfVnDay()),
      this.spentSince(ws, startOfVnMonth()),
      this.prisma.aiUsage.findMany({
        where: { workspaceId: ws },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return {
      today: { calls: day.calls, estimatedCostUsd: usd(day.cost) },
      month: { calls: month.calls, estimatedCostUsd: usd(month.cost) },
      budgets: {
        perGenerationUsd: prefs.ai.perGenerationBudgetUsd,
        dailyUsd: prefs.ai.dailyBudgetUsd,
        monthlyUsd: prefs.cost.monthlyBudgetUsd,
        hardStop: prefs.cost.hardStop,
      },
      recent: recent.map((r): AiUsageRecord => ({
        id: r.id,
        provider: r.provider,
        model: r.model,
        feature: r.feature as AiUsageRecord['feature'],
        status: r.status as AiUsageRecord['status'],
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        estimatedCostUsd: r.estimatedCostUsd?.toFixed(6) ?? null,
        latencyMs: r.latencyMs,
        errorCode: r.errorCode,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /** Tổng usage theo kịch bản (để hiển thị token/chi phí của từng phiên bản). */
  async byScripts(ws: string, ids: string[]) {
    if (!ids.length)
      return new Map<
        string,
        { calls: number; inputTokens: number; outputTokens: number; cost: number }
      >();
    const rows = await this.prisma.aiUsage.groupBy({
      by: ['scriptDraftId'],
      where: { workspaceId: ws, scriptDraftId: { in: ids } },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      _count: { _all: true },
    });
    return new Map(
      rows.map((r) => [
        r.scriptDraftId!,
        {
          calls: r._count._all,
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          cost: Number(r._sum.estimatedCostUsd ?? 0),
        },
      ]),
    );
  }
}
