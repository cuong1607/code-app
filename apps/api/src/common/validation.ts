import type { z } from 'zod';
import { AppError } from '@acs/shared';

/**
 * Kiểm tra dữ liệu bằng schema Zod DÙNG CHUNG (packages/shared).
 * Lỗi -> AppError VALIDATION_ERROR (422) kèm danh sách { path, message } tiếng Việt.
 */
export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const first = issues[0];
    throw new AppError(
      'VALIDATION_ERROR',
      first
        ? `Dữ liệu không hợp lệ: ${first.path ? `${first.path} – ` : ''}${first.message}`
        : 'Dữ liệu không hợp lệ',
      issues,
    );
  }
  return result.data;
}
