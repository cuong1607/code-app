'use client';

import {
  CheckSquare,
  Eye,
  Film,
  ListX,
  MoreHorizontal,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type VideoDraft, normalizeSearchText } from '@acs/shared';
import {
  BatchProgress,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  MediaPreview,
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
import { Progress } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSelection } from '@/hooks/use-selection';
import { describeError } from '@/lib/api/client';
import { voiceName } from '@/lib/data';
import { VIDEO_STATUS_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { hueFromString } from '@/types/domain';
import { JobDetailDialog } from './job-detail-dialog';
import type { VideoFactoryState } from './use-video-factory';

type Tab = 'all' | 'queued' | 'running' | 'completed' | 'failed';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'queued', label: 'Chờ xử lý' },
  { id: 'running', label: 'Đang chạy' },
  { id: 'completed', label: 'Hoàn thành' },
  { id: 'failed', label: 'Thất bại' },
];

const RUN_REASON = 'Chạy luồng cần worker render – dự kiến Phase 07';

/** Phase 02: mọi luồng là bản nháp đã lưu DB, trạng thái "Chờ xử lý" (chưa có worker render). */
const matchesTab = (tab: Tab) => tab === 'all' || tab === 'queued';

export function FactoryTable({ state }: { state: VideoFactoryState }) {
  const { drafts, draftsLoading, draftsError, reloadDrafts, removeDrafts } = state;
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200);
  const [detail, setDetail] = useState<VideoDraft>();
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const selection = useSelection();

  const rows = useMemo(() => {
    if (!matchesTab(tab)) return [];
    const term = normalizeSearchText(debounced);
    return drafts.filter(
      (j) => !term || normalizeSearchText(`${j.name} ${j.productName} ${j.prompt}`).includes(term),
    );
  }, [drafts, tab, debounced]);

  const counts: Record<Tab, number> = {
    all: drafts.length,
    queued: drafts.length,
    running: 0,
    completed: 0,
    failed: 0,
  };
  const segments = (['completed', 'rendering', 'queued', 'failed'] as const).map((s) => ({
    key: s,
    meta: VIDEO_STATUS_META[s],
    count: s === 'queued' ? drafts.length : 0,
  }));
  const selectedRows = drafts.filter((j) => selection.has(j.id));

  const columns: DataTableColumn<VideoDraft>[] = [
    {
      id: 'index',
      header: 'STT',
      align: 'center',
      cell: (_, i) => <span className="tabular text-muted-foreground text-xs">{i + 1}</span>,
    },
    {
      id: 'name',
      header: 'Tên luồng',
      cell: (j) => (
        <div className="flex w-52 flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setDetail(j)}
            className="line-clamp-2 cursor-pointer text-left text-[13px] leading-snug font-medium hover:underline"
          >
            {j.name}
          </button>
          <span className="text-muted-foreground font-mono text-[10px]">{j.batchKey}</span>
        </div>
      ),
    },
    {
      id: 'prompt',
      header: 'Prompt video',
      cell: (j) => (
        <Tooltip content={<span className="block max-w-80">{j.prompt}</span>}>
          <p
            tabIndex={0}
            className="text-muted-foreground line-clamp-2 w-64 cursor-help text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {j.prompt}
          </p>
        </Tooltip>
      ),
    },
    {
      id: 'images',
      header: 'Ảnh tham chiếu',
      cell: (j) =>
        j.images.length ? (
          <div className="flex items-center -space-x-2">
            {j.images.slice(0, 3).map((img) => (
              <MediaPreview
                key={img.id}
                image={{ id: img.id, url: img.previewUrl ?? undefined, hue: hueFromString(img.id) }}
                className="ring-card size-9 ring-2"
              />
            ))}
            {j.images.length > 3 ? (
              <span className="bg-muted ring-card tabular grid size-9 place-items-center rounded-md text-[11px] font-medium ring-2">
                +{j.images.length - 3}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">Không có ảnh</span>
        ),
    },
    {
      id: 'aspect',
      header: 'Tỷ lệ',
      align: 'center',
      cell: (j) => <span className="tabular text-xs font-medium">{j.config.aspectRatio}</span>,
    },
    {
      id: 'duration',
      header: 'Thời lượng',
      align: 'center',
      cell: (j) => <span className="tabular text-xs">{j.config.durationSec}s</span>,
    },
    {
      id: 'quality',
      header: 'Chất lượng',
      align: 'center',
      cell: (j) => <span className="text-xs">{j.config.quality}</span>,
    },
    {
      id: 'voice',
      header: 'Giọng đọc',
      cell: (j) => (
        <span className="block w-32 truncate text-xs" title={voiceName(j.config.voiceId)}>
          {voiceName(j.config.voiceId)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: () => <StatusBadge meta={VIDEO_STATUS_META.queued} />,
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      cell: (j) => (
        <div className="flex w-28 items-center gap-2">
          <Progress value={0} label={`Tiến độ ${j.name}`} tone="neutral" />
          <span className="tabular w-8 text-right text-xs">0%</span>
        </div>
      ),
    },
    {
      id: 'result',
      header: 'Kết quả',
      cell: () => (
        <span className="text-muted-foreground text-xs whitespace-nowrap">Chưa render</span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Thao tác</span>,
      align: 'right',
      sticky: 'right',
      cell: (j) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setDetail(j)}
            aria-label={`Xem chi tiết ${j.name}`}
          >
            <Eye />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={`Thêm thao tác cho ${j.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setDetail(j)}>
                <Eye /> Xem & sửa
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <RotateCw /> Chạy
                <span className="text-muted-foreground ml-auto text-[10px]">Phase 07</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmIds([j.id])}>
                <Trash2 /> Xoá luồng nháp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="factory-table-title"
      className="bg-card flex min-h-[560px] min-w-0 flex-col rounded-xl border shadow-xs lg:h-full lg:min-h-0"
    >
      <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="factory-table-title" className="font-semibold">
            Bảng sản xuất
          </h2>
          <BatchProgress
            segments={segments}
            title=""
            className="order-last w-full xl:order-none xl:ml-auto xl:w-[440px]"
          />
        </div>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div
            role="tablist"
            aria-label="Lọc theo trạng thái"
            className="bg-muted scrollbar-thin flex max-w-full gap-1 overflow-x-auto rounded-lg p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => {
                  setTab(t.id);
                  selection.clear();
                }}
                className={cn(
                  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  tab === t.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
                <span
                  className={cn(
                    'tabular rounded px-1.5 text-[11px]',
                    tab === t.id ? 'bg-primary/20' : 'bg-background/70',
                  )}
                >
                  {counts[t.id]}
                </span>
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm luồng, sản phẩm, prompt…"
            className="xl:ml-auto xl:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              selection.setMany(
                rows.map((r) => r.id),
                true,
              )
            }
            disabled={!rows.length}
          >
            <CheckSquare /> Chọn tất cả
          </Button>
          <Button size="sm" variant="outline" onClick={selection.clear} disabled={!selection.count}>
            <Square /> Bỏ chọn
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selection.count !== 1}
            title={selection.count !== 1 ? 'Chọn đúng 1 dòng để xem chi tiết' : undefined}
            onClick={() => setDetail(selectedRows[0])}
          >
            <Eye /> Xem chi tiết
          </Button>
          <UnavailableButton size="sm" variant="outline" reason={RUN_REASON}>
            <RotateCw /> Chạy lại
          </UnavailableButton>
          {selection.count ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setConfirmIds([...selection.selected])}
            >
              <ListX /> Xoá {selection.count} luồng
            </Button>
          ) : null}
          <span className="text-muted-foreground ml-auto text-xs">
            {selection.count ? `Đã chọn ${selection.count} · ` : ''}
            {rows.length} dòng
          </span>
        </div>
      </div>

      <DataTable
        className="min-h-0 flex-1"
        caption="Bảng tác vụ Video Factory"
        rows={rows}
        columns={columns}
        getRowId={(j) => j.id}
        selection={selection}
        loading={draftsLoading}
        error={draftsError}
        onRetry={reloadDrafts}
        minWidth={1380}
        empty={
          <EmptyState
            icon={Film}
            title={search || tab !== 'all' ? 'Không có luồng phù hợp' : 'Chưa có luồng sản xuất'}
            description={
              tab === 'running' || tab === 'completed' || tab === 'failed'
                ? 'Chưa có luồng nào được chạy – worker render sẽ có ở Phase 06/07.'
                : search
                  ? 'Thử đổi từ khoá tìm kiếm.'
                  : 'Chọn sản phẩm ở panel bên trái rồi bấm "Tạo luồng sản xuất".'
            }
          />
        }
      />

      <JobDetailDialog
        job={detail}
        onOpenChange={(open) => !open && setDetail(undefined)}
        onSaved={(d) => {
          setDetail(d);
          reloadDrafts();
        }}
      />
      <ConfirmDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => !open && setConfirmIds([])}
        destructive
        title={`Xoá ${confirmIds.length} luồng nháp?`}
        description="Luồng nháp sẽ bị xoá khỏi database. Bài đăng nháp đã gắn với luồng (nếu có) vẫn được giữ nhưng không còn gắn video."
        confirmLabel="Xoá"
        onConfirm={() => {
          const ids = confirmIds;
          void removeDrafts(ids)
            .then(() => {
              selection.setMany(ids, false);
              toast.success(`Đã xoá ${ids.length} luồng nháp`);
            })
            .catch((error: unknown) =>
              toast.error('Không xoá được', { description: describeError(error) }),
            );
        }}
      />
    </section>
  );
}
