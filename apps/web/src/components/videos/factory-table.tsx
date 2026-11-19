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
import { RUNNING_VIDEO_STATUSES } from '@acs/shared';
import {
  BatchProgress,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  DemoBadge,
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
import { type VideoJobFilter, voiceName } from '@/lib/data';
import { normalizeText } from '@/lib/data/query';
import { VIDEO_STATUS_META } from '@/lib/labels';
import type { VideoJob } from '@/types/domain';
import { cn } from '@/lib/utils';
import { JobDetailDialog } from './job-detail-dialog';
import type { VideoFactoryState } from './use-video-factory';

const TABS: { id: VideoJobFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'queued', label: 'Chờ xử lý' },
  { id: 'running', label: 'Đang chạy' },
  { id: 'completed', label: 'Hoàn thành' },
  { id: 'failed', label: 'Thất bại' },
];

function matchesTab(job: VideoJob, tab: VideoJobFilter) {
  if (tab === 'all') return true;
  if (tab === 'running') return RUNNING_VIDEO_STATUSES.includes(job.status);
  return job.status === tab;
}

const RERUN_REASON = 'Chạy lại cần backend hàng đợi sản xuất – dự kiến Phase 07';

export function FactoryTable({ state }: { state: VideoFactoryState }) {
  const { jobs, jobsLoading, jobsError, reloadJobs, removeDrafts } = state;
  const [tab, setTab] = useState<VideoJobFilter>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200);
  const [detail, setDetail] = useState<VideoJob>();
  const [confirmDraftIds, setConfirmDraftIds] = useState<string[]>([]);
  const selection = useSelection();

  const counts = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((t) => [t.id, jobs.filter((j) => matchesTab(j, t.id)).length]),
      ) as Record<VideoJobFilter, number>,
    [jobs],
  );

  const rows = useMemo(() => {
    const term = normalizeText(debounced);
    return jobs.filter(
      (j) =>
        matchesTab(j, tab) &&
        (!term || normalizeText(`${j.name} ${j.productName} ${j.prompt}`).includes(term)),
    );
  }, [jobs, tab, debounced]);

  const segments = useMemo(
    () =>
      (
        [
          'completed',
          'rendering',
          'imaging',
          'voicing',
          'scripting',
          'queued',
          'failed',
          'cancelled',
        ] as const
      ).map((s) => ({
        key: s,
        meta: VIDEO_STATUS_META[s],
        count: jobs.filter((j) => j.status === s).length,
      })),
    [jobs],
  );

  const selectedJobs = jobs.filter((j) => selection.has(j.id));
  const selectedDraftIds = selectedJobs.filter((j) => j.isLocalDraft).map((j) => j.id);

  const columns: DataTableColumn<VideoJob>[] = [
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
        <div className="flex w-52 flex-col gap-1">
          <button
            type="button"
            onClick={() => setDetail(j)}
            className="line-clamp-2 cursor-pointer text-left text-[13px] leading-snug font-medium hover:underline"
          >
            {j.name}
          </button>
          {j.isLocalDraft ? <DemoBadge label="NHÁP CỤC BỘ" /> : j.isDemo ? <DemoBadge /> : null}
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
      cell: (j) => (
        <div className="flex items-center -space-x-2">
          {j.images.slice(0, 3).map((img) => (
            <MediaPreview key={img.id} image={img} className="ring-card size-9 ring-2" />
          ))}
          {j.images.length > 3 ? (
            <span className="bg-muted ring-card tabular grid size-9 place-items-center rounded-md text-[11px] font-medium ring-2">
              +{j.images.length - 3}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'aspect',
      header: 'Tỷ lệ',
      align: 'center',
      cell: (j) => <span className="tabular text-xs font-medium">{j.aspectRatio}</span>,
    },
    {
      id: 'duration',
      header: 'Thời lượng',
      align: 'center',
      cell: (j) => <span className="tabular text-xs">{j.durationSec}s</span>,
    },
    {
      id: 'quality',
      header: 'Chất lượng',
      align: 'center',
      cell: (j) => <span className="text-xs">{j.quality}</span>,
    },
    {
      id: 'voice',
      header: 'Giọng đọc',
      cell: (j) => (
        <span className="block w-32 truncate text-xs" title={voiceName(j.voiceId)}>
          {voiceName(j.voiceId)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (j) => <StatusBadge meta={VIDEO_STATUS_META[j.status]} />,
    },
    {
      id: 'progress',
      header: 'Tiến độ',
      cell: (j) => (
        <div className="flex w-28 items-center gap-2">
          <Progress
            value={j.progress}
            label={`Tiến độ ${j.name}`}
            tone={
              j.status === 'failed'
                ? 'danger'
                : j.status === 'completed'
                  ? 'success'
                  : j.status === 'cancelled'
                    ? 'neutral'
                    : 'primary'
            }
          />
          <span className="tabular w-8 text-right text-xs">{j.progress}%</span>
        </div>
      ),
    },
    {
      id: 'result',
      header: 'Kết quả',
      cell: (j) =>
        j.status === 'completed' ? (
          <button
            type="button"
            onClick={() => setDetail(j)}
            className="group/res relative block cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            aria-label={`Xem kết quả ${j.name}`}
          >
            <MediaPreview image={j.thumbnail} aspect="9:16" kind="video" className="w-9" />
            <Film
              className="absolute inset-0 m-auto size-4 text-white opacity-0 drop-shadow group-hover/res:opacity-100"
              aria-hidden
            />
          </button>
        ) : j.status === 'failed' ? (
          <Tooltip content={j.errorMessage ?? 'Thất bại'}>
            <span
              tabIndex={0}
              className="text-danger line-clamp-2 w-32 cursor-help text-xs outline-none"
            >
              {j.errorMessage ?? 'Thất bại'}
            </span>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
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
                <Eye /> Xem chi tiết & preview
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <RotateCw /> Chạy lại
                <span className="text-muted-foreground ml-auto text-[10px]">Phase 07</span>
              </DropdownMenuItem>
              {j.isLocalDraft ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setConfirmDraftIds([j.id])}
                  >
                    <Trash2 /> Xoá luồng nháp
                  </DropdownMenuItem>
                </>
              ) : null}
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
          <DemoBadge label="DEMO + NHÁP" />
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
            onClick={() => setDetail(selectedJobs[0])}
          >
            <Eye /> Xem chi tiết
          </Button>
          <UnavailableButton size="sm" variant="outline" reason={RERUN_REASON}>
            <RotateCw /> Chạy lại
          </UnavailableButton>
          {selectedDraftIds.length ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              onClick={() => setConfirmDraftIds(selectedDraftIds)}
            >
              <ListX /> Xoá {selectedDraftIds.length} nháp
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
        loading={jobsLoading && jobs.length === 0}
        error={jobsError}
        onRetry={reloadJobs}
        minWidth={1380}
        rowClassName={(j) => (j.isLocalDraft ? 'bg-primary/4' : undefined)}
        empty={
          <EmptyState
            icon={Film}
            title={search || tab !== 'all' ? 'Không có tác vụ phù hợp' : 'Chưa có luồng sản xuất'}
            description={
              search || tab !== 'all'
                ? 'Thử đổi tab hoặc từ khoá tìm kiếm.'
                : 'Chọn sản phẩm ở panel bên trái rồi bấm "Tạo luồng sản xuất".'
            }
          />
        }
      />

      <JobDetailDialog job={detail} onOpenChange={(open) => !open && setDetail(undefined)} />
      <ConfirmDialog
        open={confirmDraftIds.length > 0}
        onOpenChange={(open) => !open && setConfirmDraftIds([])}
        destructive
        title={`Xoá ${confirmDraftIds.length} luồng nháp?`}
        description="Các luồng nháp chỉ nằm trên trình duyệt và chưa được gửi lên máy chủ. Thao tác không thể hoàn tác."
        confirmLabel="Xoá nháp"
        onConfirm={() => {
          removeDrafts(confirmDraftIds);
          selection.setMany(confirmDraftIds, false);
          toast.success(`Đã xoá ${confirmDraftIds.length} luồng nháp`);
        }}
      />
    </section>
  );
}
