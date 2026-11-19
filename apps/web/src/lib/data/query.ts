import type { ListQuery, ListResult } from '@/types/domain';

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm "ao thun" khớp "Áo thun". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export interface ApplyQueryOptions<T, SortKey extends string> {
  /** Các trường dùng để tìm kiếm */
  searchIn: (item: T) => string[];
  /** Bộ lọc bổ sung (danh mục, trạng thái...) */
  filter?: (item: T) => boolean;
  /** Giá trị để so sánh khi sắp xếp */
  sortValue?: (item: T, key: SortKey) => string | number;
}

/**
 * Tìm kiếm / lọc / sắp xếp / phân trang trên mảng.
 * Mô phỏng đúng hợp đồng mà API danh sách sẽ có ở Phase 02.
 */
export function applyListQuery<T, SortKey extends string>(
  items: readonly T[],
  query: ListQuery<SortKey>,
  options: ApplyQueryOptions<T, SortKey>,
  isDemo: boolean,
): ListResult<T> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
  const term = query.search ? normalizeText(query.search) : '';

  let result = items.filter((item) => {
    if (options.filter && !options.filter(item)) return false;
    if (!term) return true;
    return options.searchIn(item).some((field) => normalizeText(field).includes(term));
  });

  if (query.sortBy && options.sortValue) {
    const key = query.sortBy;
    const dir = query.sortDir === 'asc' ? 1 : -1;
    const sortValue = options.sortValue;
    result = [...result].sort((a, b) => {
      const va = sortValue(a, key);
      const vb = sortValue(b, key);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'vi') * dir;
    });
  }

  const total = result.length;
  const start = (page - 1) * pageSize;
  return { items: result.slice(start, start + pageSize), total, page, pageSize, isDemo };
}
