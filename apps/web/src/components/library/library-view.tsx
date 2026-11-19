'use client';

import { Check, Download, FolderOpen, LayoutGrid, List, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MEDIA_KINDS, type MediaKind } from '@acs/shared';
import {
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DemoBadge,
  DemoNotice,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  MediaPreview,
  PageHeader,
  Pagination,
  SearchInput,
  UnavailableButton,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePersistedFlag } from '@/hooks/use-persisted-flag';
import { useSelection } from '@/hooks/use-selection';
import { mediaRepository } from '@/lib/data';
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format';
import { MEDIA_KIND_LABEL } from '@/lib/labels';
import type { MediaAsset } from '@/types/domain';
import { cn } from '@/lib/utils';
import { MediaDetailDialog } from './media-detail-dialog';

type Tab = 'all' | MediaKind;
const SORTS = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'createdAt:asc', label: 'Cũ nhất' },
  { value: 'name:asc', label: 'Tên A → Z' },
  { value: 'sizeBytes:desc', label: 'Dung lượng lớn nhất' },
];
const PREVIEW_KIND = (kind: MediaKind) =>
  kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'image';

export function LibraryView() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [listView, setListView] = usePersistedFlag('acs.library.listView', false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [viewing, setViewing] = useState<MediaAsset>();
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const selection = useSelection();
  const debounced = useDebouncedValue(search);
  const pageSize = 20;
  const [sortBy, sortDir] = sort.split(':') as ['createdAt' | 'name' | 'sizeBytes', 'asc' | 'desc'];

  const list = useAsync(
    () => mediaRepository.list({ kind: tab, search: debounced, sortBy, sortDir, page, pageSize }),
    [tab, debounced, sortBy, sortDir, page],
  );
  const items = useMemo(
    () => (list.data?.items ?? []).filter((m) => !hidden.has(m.id)),
    [list.data, hidden],
  );

  const changeTab = (value: string) => {
    setTab(value as Tab);
    setPage(1);
    selection.clear();
  };

  const columns: DataTableColumn<MediaAsset>[] = [
    {
      id: 'preview',
      header: 'Xem trước',
      cell: (m) => (
        <MediaPreview image={m.preview} kind={PREVIEW_KIND(m.kind)} className="size-10 border" />
      ),
    },
    {
      id: 'name',
      header: 'Tên file',
      cell: (m) => (
        <button
          type="button"
          onClick={() => setViewing(m)}
          className="max-w-72 cursor-pointer truncate text-left font-medium hover:underline"
        >
          {m.name}
        </button>
      ),
    },
    {
      id: 'kind',
      header: 'Loại',
      cell: (m) => <span className="text-xs whitespace-nowrap">{MEDIA_KIND_LABEL[m.kind]}</span>,
    },
    {
      id: 'size',
      header: 'Dung lượng',
      align: 'right',
      cell: (m) => <span className="tabular text-xs">{formatBytes(m.sizeBytes)}</span>,
    },
    {
      id: 'meta',
      header: 'Thông số',
      cell: (m) => (
        <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
          {m.width ? `${m.width}×${m.height}` : ''}
          {m.durationSec ? `${m.width ? ' · ' : ''}${formatDuration(m.durationSec)}` : ''}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Ngày tạo',
      cell: (m) => (
        <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
          {formatDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Thao tác</span>,
      align: 'right',
      cell: (m) => (
        <Button
          size="icon-sm"
          variant="ghost"
          className="text-danger"
          onClick={() => setConfirmIds([m.id])}
          aria-label={`Xoá ${m.name}`}
        >
          <Trash2 />
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Thư viện"
        icon={FolderOpen}
        badges={<DemoBadge />}
        description="Toàn bộ ảnh, video, âm thanh và thumbnail của workspace."
        actions={
          <UnavailableButton reason="Tải file lên MinIO cần storage API (presigned URL) – dự kiến Phase 02">
            <Upload /> Tải lên
          </UnavailableButton>
        }
      />
      <DemoNotice>
        Tài nguyên đang hiển thị là <strong>DEMO</strong> (không có file thật trong storage). Xoá
        chỉ ẩn khỏi danh sách trên trình duyệt này.
      </DemoNotice>

      <div className="bg-card flex flex-col rounded-xl border shadow-xs">
        <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
          <Tabs value={tab} onValueChange={changeTab}>
            <TabsList aria-label="Loại tài nguyên">
              <TabsTrigger value="all">Tất cả</TabsTrigger>
              {MEDIA_KINDS.map((k) => (
                <TabsTrigger key={k} value={k}>
                  {MEDIA_KIND_LABEL[k]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <FilterBar
            end={
              <div
                className="bg-muted flex rounded-lg p-0.5"
                role="group"
                aria-label="Kiểu hiển thị"
              >
                <Button
                  size="icon-sm"
                  variant={listView ? 'ghost' : 'outline'}
                  aria-pressed={!listView}
                  aria-label="Dạng lưới"
                  onClick={() => setListView(false)}
                >
                  <LayoutGrid />
                </Button>
                <Button
                  size="icon-sm"
                  variant={listView ? 'outline' : 'ghost'}
                  aria-pressed={listView}
                  aria-label="Dạng danh sách"
                  onClick={() => setListView(true)}
                >
                  <List />
                </Button>
              </div>
            }
          >
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Tìm theo tên file…"
            />
            <NativeSelect
              aria-label="Sắp xếp"
              className="sm:w-48"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              options={SORTS}
            />
          </FilterBar>
          {selection.count ? (
            <div className="bg-sidebar text-sidebar-foreground flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">Đã chọn {selection.count} tài nguyên</span>
              <UnavailableButton
                size="xs"
                variant="ghost"
                reason="Tải hàng loạt cần storage API – Phase 02"
                className="[&_button]:text-sidebar-foreground"
              >
                <Download /> Tải xuống
              </UnavailableButton>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setConfirmIds([...selection.selected])}
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

        {listView ? (
          <DataTable
            caption="Thư viện tài nguyên"
            rows={items}
            columns={columns}
            getRowId={(m) => m.id}
            selection={selection}
            loading={list.loading && !list.data}
            error={list.error}
            onRetry={list.reload}
            minWidth={760}
            empty={
              <EmptyState title="Không có tài nguyên" description="Thử đổi tab hoặc từ khoá." />
            }
          />
        ) : (
          <div className="p-3 sm:p-4">
            {list.error ? (
              <ErrorState message={list.error} onRetry={list.reload} />
            ) : list.loading && !list.data ? (
              <LoadingState variant="grid" rows={10} />
            ) : items.length === 0 ? (
              <EmptyState title="Không có tài nguyên" description="Thử đổi tab hoặc từ khoá." />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items.map((m) => {
                  const checked = selection.has(m.id);
                  return (
                    <li key={m.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setViewing(m)}
                        aria-label={`Xem ${m.name}`}
                        className={cn(
                          'bg-card flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 text-left transition-all outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          checked ? 'border-primary' : 'border-border',
                        )}
                      >
                        <MediaPreview
                          image={m.preview}
                          kind={PREVIEW_KIND(m.kind)}
                          className="w-full"
                          rounded=""
                        />
                        <span className="flex flex-col gap-0.5 p-2">
                          <span className="truncate text-xs font-medium">{m.name}</span>
                          <span className="text-muted-foreground tabular text-[11px]">
                            {MEDIA_KIND_LABEL[m.kind]} · {formatBytes(m.sizeBytes)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`Chọn ${m.name}`}
                        onClick={() => selection.toggle(m.id)}
                        className={cn(
                          'absolute top-2 left-2 grid size-6 cursor-pointer place-items-center rounded-md border shadow-sm transition-all',
                          checked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-card/90 text-transparent sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100',
                        )}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                      </button>
                      {m.durationSec ? (
                        <span className="bg-sidebar/85 text-sidebar-foreground tabular pointer-events-none absolute top-2 right-2 rounded px-1 text-[10px]">
                          {formatDuration(m.durationSec)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
        <div className="border-t p-3 sm:px-4">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={Math.max(0, (list.data?.total ?? 0) - hidden.size)}
            onPageChange={setPage}
          />
        </div>
      </div>

      <MediaDetailDialog
        asset={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
        onDelete={(a) => {
          setViewing(undefined);
          setConfirmIds([a.id]);
        }}
      />
      <ConfirmDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => !open && setConfirmIds([])}
        destructive
        title={`Xoá ${confirmIds.length} tài nguyên?`}
        description="Phase 01 chưa có storage API: tài nguyên DEMO chỉ bị ẩn trên trình duyệt này, không có file nào bị xoá."
        confirmLabel="Xoá"
        onConfirm={() => {
          setHidden((prev) => new Set([...prev, ...confirmIds]));
          selection.setMany(confirmIds, false);
          toast.success(`Đã ẩn ${confirmIds.length} tài nguyên DEMO`);
        }}
      />
    </>
  );
}
