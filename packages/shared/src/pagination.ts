import { z } from 'zod';

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

/** Tham số phân trang chung cho mọi API danh sách (query string -> coerce). */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortDir: z.enum(SORT_DIRECTIONS).default('desc'),
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
});

/** Hình dạng phản hồi danh sách có phân trang. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
