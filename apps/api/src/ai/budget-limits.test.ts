import { describe, expect, it } from 'vitest';
import { type ApiEnv, AppError, appPreferencesSchema } from '@acs/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { Semaphore, SlidingWindowRateLimiter } from './ai-limits';
import { AiUsageService, startOfVnDay, startOfVnMonth } from './ai-usage.service';
import { costUsd, priceFor } from './pricing';

const env = {
  OPENAI_PRICE_INPUT_PER_MTOK: undefined,
  OPENAI_PRICE_OUTPUT_PER_MTOK: undefined,
} as unknown as ApiEnv;

/** Prisma giả: trả tổng chi phí đã dùng cố định. */
function fakePrisma(spent: number) {
  return {
    aiUsage: {
      aggregate: () => Promise.resolve({ _sum: { estimatedCostUsd: spent }, _count: { _all: 3 } }),
    },
  } as unknown as PrismaService;
}

const prefs = (ai: Record<string, unknown> = {}, cost: Record<string, unknown> = {}) =>
  appPreferencesSchema.parse({ ai, cost });

describe('Đơn giá & ước tính chi phí', () => {
  it('Claude có đơn giá; OpenAI chưa cấu hình -> null; mock = 0', () => {
    expect(priceFor('anthropic', 'claude-opus-5-5', env)).toEqual({
      inputPerMTok: 4,
      outputPerMTok: 20,
    });
    expect(priceFor('anthropic', 'model-la', env)).toBeNull();
    expect(priceFor('openai', 'gpt-x', env)).toBeNull();
    expect(priceFor('mock', 'x', env)).toEqual({ inputPerMTok: 0, outputPerMTok: 0 });
    expect(costUsd({ inputPerMTok: 4, outputPerMTok: 20 }, 1_000_000, 100_000)).toBeCloseTo(6);
  });
});

describe('Ngân sách', () => {
  it('cho phép khi trong ngân sách', async () => {
    const s = new AiUsageService(fakePrisma(0.5), env);
    const d = await s.checkBudget(
      'ws',
      prefs({ dailyBudgetUsd: 5, perGenerationBudgetUsd: 1 }),
      0.2,
    );
    expect(d.allowed).toBe(true);
    expect(d.remainingDailyUsd).toBeCloseTo(4.5);
  });

  it('từ chối khi vượt ngân sách mỗi lần tạo / ngày / tháng', async () => {
    const s = new AiUsageService(fakePrisma(4.9), env);
    expect((await s.checkBudget('ws', prefs({ perGenerationBudgetUsd: 0.1 }), 0.2)).reason).toMatch(
      /mỗi lần tạo/,
    );
    expect((await s.checkBudget('ws', prefs({ dailyBudgetUsd: 5 }), 0.2)).reason).toMatch(
      /ngân sách ngày/,
    );
    expect(
      (
        await s.checkBudget(
          'ws',
          prefs({ dailyBudgetUsd: 100 }, { monthlyBudgetUsd: 5, hardStop: true }),
          0.2,
        )
      ).reason,
    ).toMatch(/ngân sách tháng/);
  });

  it('không có đơn giá -> từ chối (không đủ thông tin dự tính an toàn)', async () => {
    const s = new AiUsageService(fakePrisma(0), env);
    const d = await s.checkBudget('ws', prefs(), null);
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/không thể dự tính/);
  });

  it('giữ chỗ: các lệnh song song không vượt ngân sách ngày', async () => {
    const s = new AiUsageService(fakePrisma(0), env);
    const p = prefs({ dailyBudgetUsd: 1, perGenerationBudgetUsd: 1 });
    const release = await s.reserve('ws', p, 0.6);
    await expect(s.reserve('ws', p, 0.6)).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    release();
    await expect(s.reserve('ws', p, 0.6)).resolves.toBeTypeOf('function');
  });

  it('ngày/tháng tính theo giờ Việt Nam', () => {
    // 2026-11-19 18:30 UTC = 2026-11-20 01:30 giờ VN -> đầu ngày VN = 2026-11-19 17:00 UTC
    const now = new Date('2026-11-19T18:30:00Z');
    expect(startOfVnDay(now).toISOString()).toBe('2026-11-19T17:00:00.000Z');
    expect(startOfVnMonth(now).toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });
});

describe('Rate limit & giới hạn đồng thời', () => {
  it('vượt số lượt/phút -> RATE_LIMITED; hết cửa sổ thì cho lại', () => {
    let t = 0;
    const rl = new SlidingWindowRateLimiter(3, 60_000, () => t);
    rl.consume('ws', 3);
    expect(() => rl.consume('ws')).toThrow(AppError);
    expect(() => rl.consume('ws-khac')).not.toThrow();
    t = 61_000;
    expect(() => rl.consume('ws')).not.toThrow();
  });

  it('semaphore giới hạn số tác vụ chạy cùng lúc', async () => {
    const sem = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        sem.run(async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active -= 1;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
