'use client';

import {
  Clapperboard,
  Download,
  Eye,
  FileSpreadsheet,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  PRODUCT_STATUSES,
  type Product,
  type ProductSortKey,
  type ProductStatus,
} from '@acs/shared';
import {
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  DemoBadge,
  EmptyState,
  FilterBar,
  MediaPreview,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NativeSelect } from '@/components/ui/native-select';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSelection } from '@/hooks/use-selection';
import { describeError } from '@/lib/api/client';
import { productRepository } from '@/lib/data';
import { formatDateTime, formatMoney } from '@/lib/format';
import { PRODUCT_STATUS_META } from '@/lib/labels';
import { hueFromString } from '@/types/domain';
import { ImportDialog } from './import-dialog';
import { ProductFormDialog } from './product-form-dialog';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'createdAt:asc', label: 'Cũ nhất' },
  { value: 'updatedAt:desc', label: 'Cập nhật gần đây' },
  { value: 'name:asc', label: 'Tên A → Z' },
  { value: 'sellingPrice:desc', label: 'Giá cao → thấp' },
  { value: 'sellingPrice:asc', label: 'Giá thấp → cao' },
];

export function ProductsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [sort, setSort] = useState<DataTableSort>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const debounced = useDebouncedValue(search);

  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new');
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Product>();
  const [confirm, setConfirm] = useState<Product[]>([]);
  const [deleting, setDeleting] = useState(false);
  const selection = useSelection();

  const list = useAsync(
    () =>
      productRepository.list({
        search: debounced || undefined,
        category: category || undefined,
        status: status || undefined,
        sortBy: sort.key as ProductSortKey,
        sortDir: sort.dir,
        page,
        pageSize,
      }),
    [debounced, category, status, sort.key, sort.dir, page, pageSize],
  );
  const categories = useAsync(() => productRepository.categories(), [list.data?.total]);
  const rows = list.data?.items ?? [];
  const filtersActive = Boolean(search || category || status);

  const resetFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('');
    setPage(1);
  };

  const closeForm = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditing(undefined);
      if (searchParams.get('action')) router.replace('/products', { scroll: false });
    }
  };

  const remove = async () => {
    setDeleting(true);
    let ok = 0;
    const failed: string[] = [];
    for (const p of confirm) {
      try {
        await productRepository.remove(p.id);
        ok += 1;
      } catch (error) {
        failed.push(`${p.sku}: ${describeError(error)}`);
      }
    }
    setDeleting(false);
    selection.setMany(
      confirm.map((p) => p.id),
      false,
    );
    setConfirm([]);
    if (ok) toast.success(`Đã xoá ${ok} sản phẩm`);
    if (failed.length)
      toast.error('Một số sản phẩm chưa xoá được', { description: failed.join('\n') });
    list.reload();
  };

  const columns: DataTableColumn<Product>[] = [
    {
      id: 'image',
      header: 'Ảnh',
      cell: (p) => (
        <MediaPreview
          image={{
            id: p.id,
            url: p.primaryImage?.previewUrl ?? undefined,
            hue: hueFromString(p.id),
            label: p.name,
          }}
          className="size-11 border"
          alt={p.name}
        />
      ),
    },
    {
      id: 'sku',
      header: 'SKU',
      sortKey: 'sku',
      cell: (p) => <span className="font-mono text-xs">{p.sku}</span>,
    },
    {
      id: 'name',
      header: 'Tên sản phẩm',
      sortKey: 'name',
      cell: (p) => (
        <div className="flex max-w-72 min-w-44 flex-col gap-0.5">
          <Link href={`/products/${p.id}`} className="truncate font-medium hover:underline">
            {p.name}
          </Link>
          {p.sourceType === 'seed' ? <DemoBadge label="MẪU" /> : null}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Danh mục',
      cell: (p) => <span className="whitespace-nowrap">{p.category}</span>,
    },
    {
      id: 'price',
      header: 'Giá bán',
      sortKey: 'sellingPrice',
      align: 'right',
      cell: (p) => (
        <span className="tabular font-medium whitespace-nowrap">
          {formatMoney(p.sellingPrice, p.currency)}
        </span>
      ),
    },
    {
      id: 'images',
      header: 'Số ảnh',
      align: 'center',
      cell: (p) => <span className="tabular">{p.imageCount}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (p) => <StatusBadge meta={PRODUCT_STATUS_META[p.status]} />,
    },
    {
      id: 'createdAt',
      header: 'Ngày tạo',
      sortKey: 'createdAt',
      cell: (p) => (
        <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
          {formatDateTime(p.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Thao tác</span>,
      align: 'right',
      sticky: 'right',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Thao tác cho ${p.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/products/${p.id}`}>
                <Eye /> Xem chi tiết & ảnh
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setEditing(p);
                setFormOpen(true);
              }}
            >
              <Pencil /> Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm([p])}>
              <Trash2 /> Xoá sản phẩm
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const exportQuery = {
    search: debounced || undefined,
    category: category || undefined,
    status: status || undefined,
    sortBy: sort.key as ProductSortKey,
    sortDir: sort.dir,
  };

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        icon={Package}
        description="Quản lý thông tin, giá bán và hình ảnh sản phẩm dùng để sản xuất nội dung. Dữ liệu lưu trong PostgreSQL."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet /> Import Excel/CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download /> Xuất file
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={productRepository.exportUrl(exportQuery, 'xlsx')} download>
                    Excel (.xlsx) – theo bộ lọc hiện tại
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={productRepository.exportUrl(exportQuery, 'csv')} download>
                    CSV UTF-8 – theo bộ lọc hiện tại
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Plus /> Thêm sản phẩm
            </Button>
          </>
        }
      />

      <div className="bg-card flex flex-col rounded-xl border shadow-xs">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
          <FilterBar canReset={filtersActive} onReset={resetFilters}>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Tìm theo tên, SKU, danh mục, thương hiệu…"
              className="sm:w-72"
            />
            <NativeSelect
              aria-label="Lọc theo danh mục"
              className="sm:w-44"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              placeholder="Tất cả danh mục"
              options={(categories.data ?? []).map((c) => ({ value: c, label: c }))}
            />
            <NativeSelect
              aria-label="Lọc theo trạng thái"
              className="sm:w-40"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ProductStatus | '');
                setPage(1);
              }}
              placeholder="Mọi trạng thái"
              options={PRODUCT_STATUSES.map((s) => ({
                value: s,
                label: PRODUCT_STATUS_META[s].label,
              }))}
            />
            <NativeSelect
              aria-label="Sắp xếp"
              className="sm:w-48"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [string, 'asc' | 'desc'];
                setSort({ key, dir });
                setPage(1);
              }}
              options={SORT_OPTIONS}
            />
          </FilterBar>
          {selection.count > 0 ? (
            <div className="bg-sidebar text-sidebar-foreground flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">Đã chọn {selection.count} sản phẩm</span>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() =>
                  router.push(`/studio/videos?products=${[...selection.selected].join(',')}`)
                }
              >
                <Clapperboard /> Tạo video từ lựa chọn
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setConfirm(rows.filter((r) => selection.has(r.id)))}
              >
                <Trash2 /> Xoá
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-muted hover:bg-sidebar-accent ml-auto"
                onClick={selection.clear}
              >
                <X /> Bỏ chọn
              </Button>
            </div>
          ) : null}
        </div>

        <DataTable
          caption="Danh sách sản phẩm"
          rows={rows}
          columns={columns}
          getRowId={(p) => p.id}
          selection={selection}
          sort={sort}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
          loading={list.loading && !list.data}
          error={list.error}
          onRetry={list.reload}
          minWidth={980}
          empty={
            <EmptyState
              title={filtersActive ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm nào'}
              description={
                filtersActive
                  ? 'Thử đổi từ khoá hoặc xoá bộ lọc.'
                  : 'Thêm sản phẩm thủ công hoặc import từ Excel/CSV.'
              }
              action={
                filtersActive ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Xoá bộ lọc
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setFormOpen(true)}>
                    <Plus /> Thêm sản phẩm
                  </Button>
                )
              }
            />
          }
        />
        <div className="border-t p-3 sm:px-4">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={list.data?.total ?? 0}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </div>
      </div>

      {formOpen ? (
        <ProductFormDialog
          open={formOpen}
          onOpenChange={closeForm}
          product={editing}
          categories={categories.data ?? []}
          onSaved={(p, created) => {
            list.reload();
            if (created) {
              toast.success(`Đã thêm "${p.name}"`, {
                description: 'Đã lưu vào database.',
                action: { label: 'Thêm ảnh', onClick: () => router.push(`/products/${p.id}`) },
              });
            } else {
              toast.success(`Đã cập nhật "${p.name}"`);
            }
          }}
        />
      ) : null}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={list.reload} />
      <ConfirmDialog
        open={confirm.length > 0}
        onOpenChange={(open) => !open && !deleting && setConfirm([])}
        destructive
        title={
          confirm.length === 1
            ? `Xoá sản phẩm "${confirm[0]?.name}"?`
            : `Xoá ${confirm.length} sản phẩm?`
        }
        description="Sản phẩm bị xoá vĩnh viễn khỏi database. Ảnh trong thư viện vẫn được giữ lại (chỉ gỡ liên kết)."
        confirmLabel={deleting ? 'Đang xoá…' : 'Xoá vĩnh viễn'}
        onConfirm={() => void remove()}
      />
    </>
  );
}
