'use client';

import {
  CalendarCheck,
  CheckSquare,
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  ShoppingCart,
  Square,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { PublishStatus } from '@acs/shared';
import {
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
import { NativeSelect } from '@/components/ui/native-select';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSelection } from '@/hooks/use-selection';
import { type PublishTab, TIKTOK_ACCOUNTS, accountById } from '@/lib/data';
import { normalizeText } from '@/lib/data/query';
import { formatDateTime } from '@/lib/format';
import { PUBLISH_MODE_LABEL, PUBLISH_STATUS_META } from '@/lib/labels';
import type { PublishPost } from '@/types/domain';
import { cn } from '@/lib/utils';
import { PostEditDialog } from './post-edit-dialog';
import type { PublishingState } from './use-publishing';

const TABS: { id: PublishTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'pending_review', label: 'Chờ kiểm duyệt' },
  { id: 'scheduled', label: 'Đã lên lịch' },
  { id: 'processing', label: 'Đang xử lý' },
  { id: 'published', label: 'Đã đăng' },
  { id: 'failed', label: 'Thất bại' },
];

const NEED_TIKTOK = 'Cần tích hợp TikTok (OAuth + Content Posting API) – dự kiến Phase 08';

export function PublishTable({ state }: { state: PublishingState }) {
  const { posts, postsLoading, postsError, reloadPosts, updateDraft, removeDrafts } = state;
  const [tab, setTab] = useState<PublishTab>('all');
  const [accountFilter, setAccountFilter] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 200);
  const [editing, setEditing] = useState<PublishPost>();
  const [confirmIds, setConfirmIds] = useState<string[]>([]);
  const selection = useSelection();

  const counts = useMemo(() => {
    const c = { all: posts.length } as Record<PublishTab, number>;
    for (const t of TABS)
      if (t.id !== 'all') c[t.id] = posts.filter((p) => p.status === t.id).length;
    return c;
  }, [posts]);

  const rows = useMemo(() => {
    const term = normalizeText(debounced);
    return posts.filter(
      (p) =>
        (tab === 'all' || p.status === (tab as PublishStatus)) &&
        (!accountFilter || p.accountId === accountFilter) &&
        (!term ||
          normalizeText(`${p.videoName} ${p.caption} ${p.hashtags.join(' ')}`).includes(term)),
    );
  }, [posts, tab, accountFilter, debounced]);

  const selectedDraftIds = posts
    .filter((p) => selection.has(p.id) && p.isLocalDraft)
    .map((p) => p.id);

  const columns: DataTableColumn<PublishPost>[] = [
    {
      id: 'video',
      header: 'Video',
      cell: (p) => (
        <div className="flex w-56 items-center gap-2.5">
          <MediaPreview image={p.thumbnail} aspect="9:16" kind="video" className="w-9 border" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setEditing(p)}
              className="line-clamp-2 cursor-pointer text-left text-[13px] leading-snug font-medium hover:underline"
            >
              {p.videoName}
            </button>
            <div className="mt-0.5">
              {p.isLocalDraft ? <DemoBadge label="NHÁP CỤC BỘ" /> : <DemoBadge />}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'account',
      header: 'Kênh TikTok',
      cell: (p) => {
        const acc = accountById(p.accountId);
        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
              style={{ background: `oklch(0.55 0.13 ${acc?.hue ?? 30})` }}
              aria-hidden
            >
              {acc?.displayName.charAt(0) ?? '?'}
            </span>
            <span className="text-xs font-medium">{acc?.handle ?? p.accountId}</span>
          </div>
        );
      },
    },
    {
      id: 'caption',
      header: 'Caption',
      cell: (p) => (
        <p
          className="text-muted-foreground line-clamp-2 w-60 text-xs leading-relaxed"
          title={p.caption}
        >
          {p.caption}
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
      cell: (p) =>
        p.productLink ? (
          <span className="inline-flex max-w-44 items-center gap-1.5 text-xs">
            <ShoppingCart className="text-primary-hover size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{p.productLink.replace('Giỏ hàng: ', '')}</span>
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Không gắn</span>
        ),
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
      cell: (p) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge meta={PUBLISH_STATUS_META[p.status]} />
          {p.errorMessage ? (
            <span className="text-danger line-clamp-2 w-40 text-[11px]" title={p.errorMessage}>
              {p.errorMessage}
            </span>
          ) : null}
        </div>
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
            <Button size="icon-sm" variant="ghost" aria-label={`Thao tác cho ${p.videoName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(p)}>
              {p.isLocalDraft ? <Pencil /> : <Eye />}{' '}
              {p.isLocalDraft ? 'Chỉnh sửa nháp' : 'Xem chi tiết'}
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <CalendarCheck /> Duyệt & lên lịch
              <span className="text-muted-foreground ml-auto text-[10px]">Phase 08</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Send /> Đăng ngay
              <span className="text-muted-foreground ml-auto text-[10px]">Phase 08</span>
            </DropdownMenuItem>
            {p.isLocalDraft ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmIds([p.id])}>
                  <Trash2 /> Xoá nháp
                </DropdownMenuItem>
              </>
            ) : null}
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
          <DemoBadge label="DEMO + NHÁP" />
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
          <NativeSelect
            aria-label="Lọc theo kênh"
            className="md:w-52"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            placeholder="Tất cả kênh"
            options={TIKTOK_ACCOUNTS.map((a) => ({ value: a.id, label: a.handle }))}
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
            {selectedDraftIds.length ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => setConfirmIds(selectedDraftIds)}
              >
                <Trash2 /> Xoá {selectedDraftIds.length} nháp
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
        loading={postsLoading && posts.length === 0}
        error={postsError}
        onRetry={reloadPosts}
        minWidth={1280}
        rowClassName={(p) => (p.isLocalDraft ? 'bg-primary/4' : undefined)}
        empty={
          <EmptyState
            icon={CalendarCheck}
            title="Không có bài đăng phù hợp"
            description={
              search || accountFilter || tab !== 'all'
                ? 'Thử đổi tab, kênh hoặc từ khoá.'
                : 'Tạo lịch đăng ở panel bên trái.'
            }
          />
        }
      />

      {editing ? (
        <PostEditDialog
          post={editing}
          onOpenChange={(open) => !open && setEditing(undefined)}
          onSave={(p) => {
            updateDraft(p);
            toast.success('Đã cập nhật bài đăng nháp');
          }}
        />
      ) : null}
      <ConfirmDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => !open && setConfirmIds([])}
        destructive
        title={`Xoá ${confirmIds.length} bài đăng nháp?`}
        description="Bài nháp chỉ nằm trên trình duyệt, chưa gửi lên TikTok. Không thể hoàn tác."
        confirmLabel="Xoá nháp"
        onConfirm={() => {
          removeDrafts(confirmIds);
          selection.setMany(confirmIds, false);
          toast.success(`Đã xoá ${confirmIds.length} bài nháp`);
        }}
      />
    </section>
  );
}
