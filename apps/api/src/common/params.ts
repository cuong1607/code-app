import { z } from 'zod';
import { AppError } from '@acs/shared';

const uuid = z.uuid();

/** Kiểm tra tham số :id là UUID (tránh lỗi Prisma khó hiểu với id sai định dạng). */
export function parseId(value: string, label = 'id'): string {
  if (!uuid.safeParse(value).success)
    throw new AppError('VALIDATION_ERROR', `${label} không hợp lệ`);
  return value;
}

export function parseBool(value: unknown): boolean {
  return value === 'true' || value === '1' || value === true;
}
