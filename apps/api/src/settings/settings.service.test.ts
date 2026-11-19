import { describe, expect, it } from 'vitest';
import { appPreferencesSchema } from '@acs/shared';
import { deepMerge } from './settings.service';

describe('deepMerge cài đặt', () => {
  it('chỉ thay nhóm được gửi lên, giữ nguyên các nhóm khác', () => {
    const current = appPreferencesSchema.parse({ batch: { concurrency: 5 } });
    const merged = appPreferencesSchema.parse(
      deepMerge(current, { cost: { monthlyBudgetUsd: 120 } }),
    );
    expect(merged.batch.concurrency).toBe(5);
    expect(merged.cost.monthlyBudgetUsd).toBe(120);
    expect(merged.cost.alertPercent).toBe(80);
  });

  it('schema strict từ chối khoá lạ (không thể lén lưu API key)', () => {
    const current = appPreferencesSchema.parse({});
    expect(appPreferencesSchema.safeParse(deepMerge(current, { apiKey: 'sk-xxx' })).success).toBe(
      false,
    );
    expect(
      appPreferencesSchema.safeParse(deepMerge(current, { cost: { secret: 'x' } })).success,
    ).toBe(false);
  });
});
