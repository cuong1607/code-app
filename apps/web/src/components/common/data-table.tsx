'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Selection } from '@/hooks/use-selection';
import type { SortDirection } from '@/types/domain';
import { cn } from '@/lib/utils';
import { ErrorState, LoadingState } from './states';

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Bật sắp xếp theo khoá này */
  sortKey?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  headerClassName?: string;
  /** Ghim cột khi cuộn ngang */
  sticky?: 'right';
}

export interface DataTableSort {
  key: string;
  dir: SortDirection;
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  caption: string;
  selection?: Selection;
  isRowSelectable?: (row: T) => boolean;
  sort?: DataTableSort;
  onSortChange?: (sort: DataTableSort) => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  empty?: React.ReactNode;
  /** Chiều rộng tối thiểu của bảng – vượt quá thì cuộn ngang trong khung */
  minWidth?: number;
  /** Giới hạn chiều cao để cuộn dọc với header dính */
  maxHeight?: string;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' } as const;

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  caption,
  selection,
  isRowSelectable = () => true,
  sort,
  onSortChange,
  loading,
  error,
  onRetry,
  empty,
  minWidth = 720,
  maxHeight,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const selectableIds = rows.filter(isRowSelectable).map(getRowId);
  const selectedOnPage = selection ? selectableIds.filter((id) => selection.has(id)).length : 0;
  const allChecked = selectableIds.length > 0 && selectedOnPage === selectableIds.length;
  const headerState: boolean | 'indeterminate' = allChecked
    ? true
    : selectedOnPage > 0
      ? 'indeterminate'
      : false;

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    onSortChange({ key, dir: sort?.key === key && sort.dir === 'desc' ? 'asc' : 'desc' });
  };

  return (
    <div
      className={cn('scrollbar-thin relative w-full overflow-auto', className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/70 sticky top-0 z-10 backdrop-blur">
          <tr>
            {selection ? (
              <th scope="col" className="w-10 border-b px-3 py-2.5">
                <Checkbox
                  aria-label="Chọn tất cả dòng trên trang"
                  checked={headerState}
                  disabled={!selectableIds.length}
                  onCheckedChange={(value) => selection.setMany(selectableIds, value === true)}
                />
              </th>
            ) : null}
            {columns.map((col) => {
              const active = sort?.key === col.sortKey;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={
                    col.sortKey && active
                      ? sort?.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(
                    'text-muted-foreground border-b px-3 py-2.5 text-xs font-semibold whitespace-nowrap',
                    ALIGN[col.align ?? 'left'],
                    col.sticky === 'right' && 'bg-muted/95 sticky right-0',
                    col.headerClassName,
                  )}
                >
                  {col.sortKey && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sortKey!)}
                      className={cn(
                        'hover:text-foreground inline-flex cursor-pointer items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                        active && 'text-foreground',
                      )}
                    >
                      {col.header}
                      {active ? (
                        sort?.dir === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)}>
                <LoadingState rows={6} />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)}>
                <ErrorState message={error} onRetry={onRetry} />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selection ? 1 : 0)}>{empty}</td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const id = getRowId(row);
              const selected = selection?.has(id) ?? false;
              return (
                <tr
                  key={id}
                  data-state={selected ? 'selected' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'group/row hover:bg-accent/50 data-[state=selected]:bg-primary/8 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(row),
                  )}
                >
                  {selection ? (
                    <td
                      className="border-b px-3 py-2.5 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        aria-label="Chọn dòng"
                        checked={selected}
                        disabled={!isRowSelectable(row)}
                        onCheckedChange={() => selection.toggle(id)}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn(
                        'border-b px-3 py-2.5 align-middle',
                        ALIGN[col.align ?? 'left'],
                        col.sticky === 'right' &&
                          'bg-card group-hover/row:bg-accent group-data-[state=selected]/row:bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] sticky right-0 shadow-[-8px_0_8px_-8px_oklch(0_0_0/0.12)]',
                        col.className,
                      )}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
