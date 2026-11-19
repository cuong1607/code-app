'use client';

import {
  Eye,
  FileSpreadsheet,
  Link2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PRODUCT_STATUSES, type ProductStatus } from '@acs/shared';
import {
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  DemoBadge,
  DemoNotice,
  EmptyState,
  FilterBar,
  MediaPreview,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  UnavailableButton,
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
import { CATEGORIES, type ProductSortKey, categoryName, productRepository } from '@/lib/data';
import { formatDateTime, formatVnd } from '@/lib/format';
import { PRODUCT_STATUS_META } from '@/lib/labels';
import type { Product } from '@/types/domain';
import { ProductDetailDialog } from './product-detail-dialog';
import { ProductFormDialog, type ProductFormResult } from './product-form-dialog';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'createdAt:asc', label: 'Cũ nhất' },
  { value: 'name:asc', label: 'Tên A → Z' },
  { value: 'price:desc', label: 'Giá cao → thấp' },
  { value: 'price:asc', label: 'Giá thấp → cao' },
  { value: 'imageCount:desc', label: 'Nhiều ảnh nhất' },
];

export function ProductsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [sort, setSort] = useState<DataTableSort>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debounced = useDebouncedValue(search);

  // Bản nháp cục bộ (Phase 01 chưa có backend) – chỉ tồn tại trong phiên trình duyệt
  const [drafts, setDrafts] = useState<Product[]>([]);
  const [edits, setEdits] = useState<Record<string, Product>>({});
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const [formOpen, setFormOpen] = useState(searchParams.get('action') === 'new');
  const [editing, setEditing] = useState<Product>();
  const [viewing, setViewing] = useState<Product>();
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const selection = useSelection();

  const list = useAsync(
    () =>
      productRepository.list({
        search: debounced,
        categoryId,
        status,
        sortBy: sort.key as ProductSortKey,
        sortDir: sort.dir,
        page,
        pageSize,
      }),
    [debounced, categoryId, status, sort.key, sort.dir, page, pageSize],
  );

  const rows = useMemo(() => {
    const base = (list.data?.items ?? []).map((p) => edits[p.id] ?? p);
    const top = page === 1 ? drafts : [];
    return [...top, ...base].filter((p) => !hidden.has(p.id));
  }, [list.data, edits, drafts, hidden, page]);

  const filtersActive = Boolean(search || categoryId || status);
  const resetFilters = () => {
    setSearch('');
    setCategoryId('');
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

  const handleSubmit = ({ input, images }: ProductFormResult) => {
    if (editing) {
      const updated: Product = {
        ...editing,
        name: input.name,
        sku: input.sku,
        categoryId: input.category,
        price: input.price,
        status: input.status,
        description: input.description,
        sourceUrl: input.sourceUrl || undefined,
        images,
        isLocalDraft: true,
      };
      if (drafts.some((d) => d.id === editing.id))
        setDrafts((d) => d.map((x) => (x.id === editing.id ? updated : x)));
      else setEdits((e) => ({ ...e, [editing.id]: updated }));
      toast.info('Đã cập nhật bản nháp trên trình duyệt', {
        description: 'Chưa lưu vào database (cần backend Phase 02).',
      });
    } else {
      const product: Product = {
        id: `local-${crypto.randomUUID()}`,
        name: input.name,
        sku: input.sku,
        categoryId: input.category,
        price: input.price,
        status: input.status,
        description: input.description,
        sourceUrl: input.sourceUrl || undefined,
        images,
        createdAt: new Date().toISOString(),
        isDemo: false,
        isLocalDraft: true,
      };
      setDrafts((d) => [product, ...d]);
      toast.info('Đã tạo bản nháp sản phẩm', {
        description: 'Chỉ lưu tạm trên trình duyệt – chưa lưu vào database.',
      });
    }
  };

  const columns: DataTableColumn<Product>[] = [
    {
      id: 'image',
      header: 'Ảnh',
      cell: (p) => (
        <MediaPreview
          image={p.images.find((i) => i.isPrimary) ?? p.images[0]}
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
          <button
            type="button"
            onClick={() => setViewing(p)}
            className="cursor-pointer truncate text-left font-medium hover:underline"
          >
            {p.name}
          </button>
          {p.isLocalDraft ? <DemoBadge label="NHÁP CỤC BỘ" /> : null}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Danh mục',
      cell: (p) => <span className="whitespace-nowrap">{categoryName(p.categoryId)}</span>,
    },
    {
      id: 'price',
      header: 'Giá bán',
      sortKey: 'price',
      align: 'right',
      cell: (p) => (
        <span className="tabular font-medium whitespace-nowrap">{formatVnd(p.price)}</span>
      ),
    },
    {
      id: 'images',
      header: 'Số ảnh',
      sortKey: 'imageCount',
      align: 'center',
      cell: (p) => <span className="tabular">{p.images.length}</span>,
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
            <DropdownMenuItem onSelect={() => setViewing(p)}>
              <Eye /> Xem chi tiết
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
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmIds([p.id])}>
              <Trash2 /> Ẩn khỏi danh sách
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const total = Math.max(0, (list.data?.total ?? 0) + drafts.length - hidden.size);

  return (
    <>
      <PageHeader
        title="Sản phẩm"
        icon={Package}
        badges={<DemoBadge />}
        description="Quản lý thông tin, giá bán và hình ảnh sản phẩm dùng để sản xuất nội dung."
        actions={
          <>
            <UnavailableButton
              variant="outline"
              reason="Import Excel/CSV cần API import & hàng đợi xử lý – dự kiến Phase 02"
            >
              <FileSpreadsheet /> Import Excel/CSV
            </UnavailableButton>
            <UnavailableButton
              variant="outline"
              reason="Thu thập sản phẩm từ URL – dự kiến Phase 02"
            >
              <Link2 /> Import URL
            </UnavailableButton>
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

      <DemoNotice>
        Danh sách đang hiển thị <strong>dữ liệu DEMO</strong>. Thêm/sửa/ẩn sản phẩm chỉ tạo bản nháp
        trên trình duyệt,
        <strong> không ghi vào database</strong> cho tới khi có API ở Phase 02.
      </DemoNotice>

      <div className="bg-card flex flex-col rounded-xl border shadow-xs">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
          <FilterBar canReset={filtersActive} onReset={resetFilters}>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Tìm theo tên, SKU, danh mục…"
              className="sm:w-72"
            />
            <NativeSelect
              aria-label="Lọc theo danh mục"
              className="sm:w-44"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              placeholder="Tất cả danh mục"
              options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
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
              className="sm:w-44"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':') as [string, 'asc' | 'desc'];
                setSort({ key, dir });
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
                onClick={() => router.push('/studio/videos')}
              >
                Tạo video từ lựa chọn
              </Button>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setConfirmIds([...selection.selected])}
              >
                <Trash2 /> Ẩn
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
              title="Không tìm thấy sản phẩm"
              description={
                filtersActive
                  ? 'Thử đổi từ khoá hoặc xoá bộ lọc.'
                  : 'Bắt đầu bằng cách thêm sản phẩm đầu tiên.'
              }
              action={
                filtersActive ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Xoá bộ lọc
                  </Button>
                ) : null
              }
            />
          }
        />
        <div className="border-t p-3 sm:px-4">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
          />
        </div>
      </div>

      {formOpen ? (
        <ProductFormDialog
          open={formOpen}
          onOpenChange={closeForm}
          product={editing}
          onSubmit={handleSubmit}
        />
      ) : null}
      <ProductDetailDialog
        product={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
        onEdit={(p) => {
          setViewing(undefined);
          setEditing(p);
          setFormOpen(true);
        }}
      />
      <ConfirmDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => !open && setConfirmIds([])}
        destructive
        title={`Ẩn ${confirmIds.length} sản phẩm khỏi danh sách?`}
        description="Phase 01 chưa có backend nên thao tác này chỉ ẩn sản phẩm trên trình duyệt hiện tại; dữ liệu không bị xoá."
        confirmLabel="Ẩn sản phẩm"
        onConfirm={() => {
          setHidden((prev) => new Set([...prev, ...confirmIds]));
          selection.setMany(confirmIds, false);
          toast.success(`Đã ẩn ${confirmIds.length} sản phẩm`, {
            description: 'Tải lại trang để hiện lại.',
          });
        }}
      />
    </>
  );
}
