'use client';

import {
  CalendarCheck,
  CheckSquare,
  MoreHorizontal,
  Pencil,
  Send,
  Square,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { type PublishStatus, type PublishingDraft, normalizeSearchText } from '@acs/shared';
import {
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
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSelection } from '@/hooks/use-selection';
import { describeError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/format';
import { PUBLISH_MODE_LABEL, PUBLISH_STATUS_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { hueFromString } from '@/types/domain';
import { PostEditDialog } from './post-edit-dialog';
import type { PublishingState } from './use-publishing';

type Tab = 'all' | PublishStatus;
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending_review', label: 'Chờ kiểm duyệt' },
  { id: 'scheduled', label: 'Đã lên lịch' },
  { id: 'processing', label: 'Đang xử lý' },
  { id: 'published', label: 'Đã đăng' },
  { id: 'failed', label: 'Thất bại' },
];

const NEED_TIKTOK = 'Cần tích hợp TikTok (OAuth + Content Posting API) – dự kiến Phase 08';

export function PublishTable({ state }: { state: PublishingState }) {
  const { posts, postsLoading, postsError, reloadPosts, updateDraft, removeDrafts, videos } = state;
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200);
  const [editing, setEditing] = useState<PublishingDraft>();
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const selection = useSelection();

  const thumbOf = useMemo(
    () => new Map(videos.map((v) => [v.id, v.images[0]?.previewUrl ?? undefined])),
    [videos],
  );

  const counts = useMemo(() => {
    const c = { all: posts.length } as Record<Tab, number>;
    for (const t of TABS)
      if (t.id !== 'all') c[t.id] = posts.filter((p) => p.status === t.id).length;
    return c;
  }, [posts]);

  const rows = useMemo(() => {
    const term = normalizeSearchText(debounced);
    return posts.filter(
      (p) =>
        (tab === 'all' || p.status === tab) &&
        (!term ||
          normalizeSearchText(`${p.videoName} ${p.caption} ${p.hashtags.join(' ')}`).includes(
            term,
          )),
    );
  }, [posts, tab, debounced]);

  const columns: DataTableColumn<PublishingDraft>[] = [
    {
      id: 'video',
      header: 'Video',
      cell: (p) => (
        <div className="flex w-56 items-center gap-2.5">
          <MediaPreview
            image={{
              id: p.id,
              url: p.videoDraftId ? thumbOf.get(p.videoDraftId) : undefined,
              hue: hueFromString(p.videoDraftId ?? p.id),
            }}
            aspect="9:16"
            kind="video"
            className="w-9 border"
          />
          <button
            type="button"
            onClick={() => setEditing(p)}
            className="line-clamp-2 cursor-pointer text-left text-[13px] leading-snug font-medium hover:underline"
          >
            {p.videoName}
          </button>
        </div>
      ),
    },
    {
      id: 'account',
      header: 'Kênh TikTok',
      cell: (p) => (
        <span className={cn('text-xs whitespace-nowrap', !p.accountRef && 'text-muted-foreground')}>
          {p.accountRef ?? 'Chưa gắn kênh'}
        </span>
      ),
    },
    {
      id: 'caption',
      header: 'Caption',
      cell: (p) => (
        <p
          className="text-muted-foreground line-clamp-2 w-60 text-xs leading-relaxed"
          title={p.caption}
        >
          {p.caption || '—'}
        </p>
      ),
    },
    {
      id: 'hashtags',
      header: 'Hashtag',
      cell: (p) => (
        <div className="flex w-40 flex-wrap gap-1">
          {p.hashtags.slice(0, 3).map((t) => (
            <span key={t} className="bg-info/10 text-info rounded px-1.5 py-0.5 text-[11px]">
              {t}
            </span>
          ))}
          {p.hashtags.length > 3 ? (
            <span className="text-muted-foreground text-[11px]">+{p.hashtags.length - 3}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'cart',
      header: 'Sản phẩm/giỏ hàng',
      cell: () => <span className="text-muted-foreground text-xs">Không gắn</span>,
    },
    {
      id: 'mode',
      header: 'Chế độ đăng',
      cell: (p) => <span className="text-xs whitespace-nowrap">{PUBLISH_MODE_LABEL[p.mode]}</span>,
    },
    {
      id: 'time',
      header: 'Ngày giờ dự kiến',
      cell: (p) => (
        <time dateTime={p.scheduledAt} className="tabular text-xs font-medium whitespace-nowrap">
          {formatDateTime(p.scheduledAt)}
        </time>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: (p) => <StatusBadge meta={PUBLISH_STATUS_META[p.status]} />,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Thao tác</span>,
      align: 'right',
      sticky: 'right',
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label={`Thao tác cho ${p.videoName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(p)}>
              <Pencil /> Chỉnh sửa nháp
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CalendarCheck /> Duyệt & lên lịch
              <span className="text-muted-foreground ml-auto text-[10px]">Phase 08</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Send /> Đăng ngay
              <span className="text-muted-foreground ml-auto text-[10px]">Phase 08</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmIds([p.id])}>
              <Trash2 /> Xoá nháp
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <section
      aria-labelledby="publish-table-title"
      className="bg-card flex min-h-[560px] min-w-0 flex-col rounded-xl border shadow-xs lg:h-full lg:min-h-0"
    >
      <div className="flex flex-col gap-3 border-b p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="publish-table-title" className="font-semibold">
            Danh sách lịch đăng
          </h2>
          <span className="text-muted-foreground ml-auto text-xs">
            Thời gian hiển thị theo giờ Việt Nam (UTC+7)
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Lọc theo trạng thái"
          className="bg-muted scrollbar-thin flex max-w-full gap-1 self-start overflow-x-auto rounded-lg p-1"
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
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Tìm video, caption, hashtag…"
            className="md:w-64"
          />
          <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
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
            <Button
              size="sm"
              variant="outline"
              onClick={selection.clear}
              disabled={!selection.count}
            >
              <Square /> Bỏ chọn
            </Button>
            <UnavailableButton size="sm" variant="outline" reason={NEED_TIKTOK}>
              <CalendarCheck /> Duyệt ({selection.count})
            </UnavailableButton>
            {selection.count ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => setConfirmIds([...selection.selected])}
              >
                <Trash2 /> Xoá {selection.count} nháp
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <DataTable
        className="min-h-0 flex-1"
        caption="Danh sách lịch đăng TikTok"
        rows={rows}
        columns={columns}
        getRowId={(p) => p.id}
        selection={selection}
        loading={postsLoading}
        error={postsError}
        onRetry={reloadPosts}
        minWidth={1220}
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="Không có bài đăng phù hợp"
            description={
              tab !== 'all' && tab !== 'pending_review'
                ? 'Chưa có bài nào được duyệt/đăng – cần tích hợp TikTok (Phase 08).'
                : search
                  ? 'Thử đổi từ khoá.'
                  : 'Tạo lịch đăng ở panel bên trái.'
            }
          />
        }
      />

      {editing ? (
        <PostEditDialog
          post={editing}
          onOpenChange={(open) => !open && setEditing(undefined)}
          onSave={(patch) => updateDraft(editing, patch)}
        />
      ) : null}
      <ConfirmDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => !open && setConfirmIds([])}
        destructive
        title={`Xoá ${confirmIds.length} bài đăng nháp?`}
        description="Bài nháp sẽ bị xoá khỏi database. Không thể hoàn tác."
        confirmLabel="Xoá nháp"
        onConfirm={() => {
          const ids = confirmIds;
          void removeDrafts(ids)
            .then(() => {
              selection.setMany(ids, false);
              toast.success(`Đã xoá ${ids.length} bài nháp`);
            })
            .catch((error: unknown) =>
              toast.error('Không xoá được', { description: describeError(error) }),
            );
        }}
      />
    </section>
  );
}
