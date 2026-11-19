'use client';

import { Check, Download, FolderOpen, LayoutGrid, List, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MEDIA_KINDS,
  type MediaAsset,
  type MediaKind,
} from '@acs/shared';
import {
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  MediaPreview,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePersistedFlag } from '@/hooks/use-persisted-flag';
import { useSelection } from '@/hooks/use-selection';
import { ApiError, describeError } from '@/lib/api/client';
import { MAX_UPLOAD_MB, mediaRepository } from '@/lib/data';
import { formatBytes, formatDateTime } from '@/lib/format';
import { MEDIA_KIND_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { assetToImageRef } from '@/types/domain';
import { MediaDetailDialog, downloadAsset } from './media-detail-dialog';

type Tab = 'all' | MediaKind;
const SORTS = [
  { value: 'createdAt:desc', label: 'Mới nhất' },
  { value: 'createdAt:asc', label: 'Cũ nhất' },
  { value: 'filename:asc', label: 'Tên A → Z' },
  { value: 'fileSize:desc', label: 'Dung lượng lớn nhất' },
];
const PREVIEW_KIND = (kind: MediaKind) =>
  kind === 'VIDEO' ? 'video' : kind === 'AUDIO' ? 'audio' : 'image';
const FUTURE_KIND_NOTE: Partial<Record<MediaKind, string>> = {
  AI_IMAGE: 'Ảnh AI sẽ xuất hiện ở đây khi có image provider (Phase 04).',
  VIDEO: 'Video sẽ xuất hiện ở đây khi có chức năng dựng video (Phase 06).',
  AUDIO: 'Giọng đọc sẽ xuất hiện ở đây khi có TTS provider (Phase 05).',
  THUMBNAIL: 'Thumbnail sẽ được tạo cùng video (Phase 06).',
};

export function LibraryView() {
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [listView, setListView] = usePersistedFlag('acs.library.listView', false);
  const [viewing, setViewing] = useState<MediaAsset>();
  const [confirm, setConfirm] = useState<{ assets: MediaAsset[]; force: boolean } | null>(null);
  const [uploading, setUploading] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useSelection();
  const debounced = useDebouncedValue(search);
  const pageSize = 24;
  const [sortBy, sortDir] = sort.split(':') as [
    'createdAt' | 'filename' | 'fileSize',
    'asc' | 'desc',
  ];

  const list = useAsync(
    () =>
      mediaRepository.list({
        type: tab === 'all' ? undefined : tab,
        search: debounced || undefined,
        sortBy,
        sortDir,
        page,
        pageSize,
      }),
    [tab, debounced, sortBy, sortDir, page],
  );
  const items = list.data?.items ?? [];

  const changeTab = (value: string) => {
    setTab(value as Tab);
    setPage(1);
    selection.clear();
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const all = Array.from(files).slice(0, 20);
    setUploading(all.length);
    let ok = 0;
    let dup = 0;
    const errors: string[] = [];
    for (const file of all) {
      try {
        const res = await mediaRepository.upload(file);
        if (res.duplicate) dup += 1;
        else ok += 1;
      } catch (error) {
        errors.push(describeError(error));
      }
      setUploading((n) => n - 1);
    }
    if (ok) toast.success(`Đã tải lên ${ok} ảnh`);
    if (dup) toast.info(`${dup} ảnh trùng nội dung với ảnh đã có – không tạo bản sao`);
    if (errors.length)
      toast.error('Một số ảnh không tải lên được', { description: errors.join('\n') });
    if (fileInput.current) fileInput.current.value = '';
    list.reload();
  };

  const remove = async (assets: MediaAsset[], force: boolean) => {
    let ok = 0;
    const inUse: MediaAsset[] = [];
    const errors: string[] = [];
    for (const a of assets) {
      try {
        await mediaRepository.remove(a.id, force);
        ok += 1;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'CONFLICT') inUse.push(a);
        else errors.push(`${a.filename}: ${describeError(error)}`);
      }
    }
    selection.setMany(
      assets.map((a) => a.id),
      false,
    );
    if (ok) toast.success(`Đã xoá ${ok} tài nguyên`);
    if (errors.length)
      toast.error('Một số tài nguyên chưa xoá được', { description: errors.join('\n') });
    list.reload();
    // Ảnh đang được sản phẩm sử dụng -> hỏi xác nhận lần 2 (gỡ khỏi sản phẩm)
    if (inUse.length) setConfirm({ assets: inUse, force: true });
  };

  const columns: DataTableColumn<MediaAsset>[] = [
    {
      id: 'preview',
      header: 'Xem trước',
      cell: (m) => (
        <MediaPreview
          image={assetToImageRef(m)}
          kind={PREVIEW_KIND(m.assetType)}
          className="size-10 border"
        />
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
          {m.filename}
        </button>
      ),
    },
    {
      id: 'kind',
      header: 'Loại',
      cell: (m) => (
        <span className="text-xs whitespace-nowrap">{MEDIA_KIND_LABEL[m.assetType]}</span>
      ),
    },
    {
      id: 'size',
      header: 'Dung lượng',
      align: 'right',
      cell: (m) => <span className="tabular text-xs">{formatBytes(m.fileSize)}</span>,
    },
    {
      id: 'meta',
      header: 'Thông số',
      cell: (m) => (
        <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
          {m.width ? `${m.width}×${m.height}` : '—'}
        </span>
      ),
    },
    {
      id: 'used',
      header: 'Dùng bởi',
      align: 'center',
      cell: (m) => <span className="tabular text-xs">{m.linkedProductCount}</span>,
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
        <div className="flex justify-end gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => void downloadAsset(m)}
            aria-label={`Tải ${m.filename}`}
          >
            <Download />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirm({ assets: [m], force: false })}
            aria-label={`Xoá ${m.filename}`}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  const emptyNote = tab !== 'all' ? FUTURE_KIND_NOTE[tab] : undefined;

  return (
    <>
      <PageHeader
        title="Thư viện"
        icon={FolderOpen}
        description="Ảnh, video, âm thanh và thumbnail của workspace – lưu trên MinIO, thông tin lưu trong PostgreSQL."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
              className="sr-only"
              aria-label="Chọn ảnh để tải lên"
              onChange={(e) => void upload(e.target.files)}
            />
            <Button onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
              <Upload /> {uploading > 0 ? `Đang tải lên (${uploading})…` : 'Tải ảnh lên'}
            </Button>
          </>
        }
      />

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
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              options={SORTS}
            />
          </FilterBar>
          {selection.count ? (
            <div className="bg-sidebar text-sidebar-foreground flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <span className="font-medium">Đã chọn {selection.count} tài nguyên</span>
              <Button
                size="xs"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() =>
                  setConfirm({ assets: items.filter((i) => selection.has(i.id)), force: false })
                }
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
            minWidth={820}
            empty={
              <EmptyState
                title="Không có tài nguyên"
                description={emptyNote ?? 'Tải ảnh lên hoặc đổi từ khoá.'}
              />
            }
          />
        ) : (
          <div className="p-3 sm:p-4">
            {list.error ? (
              <ErrorState message={list.error} onRetry={list.reload} />
            ) : list.loading && !list.data ? (
              <LoadingState variant="grid" rows={10} />
            ) : items.length === 0 ? (
              <EmptyState
                title={search ? 'Không tìm thấy tài nguyên' : 'Chưa có tài nguyên'}
                description={
                  emptyNote ??
                  (search
                    ? 'Thử đổi từ khoá.'
                    : `Tải ảnh JPG, PNG, WebP (tối đa ${MAX_UPLOAD_MB} MB) lên thư viện.`)
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items.map((m) => {
                  const checked = selection.has(m.id);
                  return (
                    <li key={m.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setViewing(m)}
                        aria-label={`Xem ${m.filename}`}
                        className={cn(
                          'bg-card flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 text-left transition-all outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
                          checked ? 'border-primary' : 'border-border',
                        )}
                      >
                        <MediaPreview
                          image={assetToImageRef(m)}
                          kind={PREVIEW_KIND(m.assetType)}
                          className="bg-checker w-full"
                          rounded=""
                          alt={m.filename}
                        />
                        <span className="flex flex-col gap-0.5 p-2">
                          <span className="truncate text-xs font-medium">{m.filename}</span>
                          <span className="text-muted-foreground tabular text-[11px]">
                            {MEDIA_KIND_LABEL[m.assetType]} · {formatBytes(m.fileSize)}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`Chọn ${m.filename}`}
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
                      {m.linkedProductCount ? (
                        <span className="bg-sidebar/85 text-sidebar-foreground tabular pointer-events-none absolute top-2 right-2 rounded px-1 text-[10px]">
                          {m.linkedProductCount} SP
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
            total={list.data?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </div>

      <MediaDetailDialog
        asset={viewing}
        onOpenChange={(open) => !open && setViewing(undefined)}
        onDelete={(a) => {
          setViewing(undefined);
          setConfirm({ assets: [a], force: false });
        }}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        destructive
        title={
          confirm?.force
            ? `${confirm.assets.length} ảnh đang được sản phẩm sử dụng`
            : `Xoá ${confirm?.assets.length ?? 0} tài nguyên?`
        }
        description={
          confirm?.force
            ? 'Xoá sẽ GỠ ảnh khỏi các sản phẩm đang dùng và xoá file khỏi storage. Không thể hoàn tác.'
            : 'File sẽ bị xoá khỏi storage (MinIO) và database. Không thể hoàn tác.'
        }
        confirmLabel={confirm?.force ? 'Gỡ khỏi sản phẩm và xoá' : 'Xoá'}
        onConfirm={() => {
          if (confirm) void remove(confirm.assets, confirm.force);
        }}
      />
    </>
  );
}
