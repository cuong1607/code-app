'use client';

import {
  CalendarClock,
  Clapperboard,
  FileText,
  HardDrive,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Package,
  PackageCheck,
} from 'lucide-react';
import Link from 'next/link';
import type { VideoDraft } from '@acs/shared';
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorState,
  LoadingState,
  MediaPreview,
  PageHeader,
  StatCard,
  StatusBadge,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { useAsync } from '@/hooks/use-async';
import { dashboardRepository, videoDraftRepository } from '@/lib/data';
import { formatBytes, formatDateTime, formatNumber } from '@/lib/format';
import { VIDEO_STATUS_META } from '@/lib/labels';
import { hueFromString } from '@/types/domain';
import { ActivityFeed } from './activity-feed';
import { Panel } from './panel';
import { QuickActions } from './quick-actions';
import { VideosPerDayChart } from './videos-per-day-chart';

const DRAFT_COLUMNS: DataTableColumn<VideoDraft>[] = [
  {
    id: 'name',
    header: 'Luồng sản xuất',
    cell: (d) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <MediaPreview
          image={{ id: d.id, url: d.images[0]?.previewUrl ?? undefined, hue: hueFromString(d.id) }}
          className="size-9"
        />
        <div className="min-w-0">
          <p className="max-w-64 truncate font-medium">{d.name}</p>
          <p className="text-muted-foreground text-xs">
            {d.config.durationSec}s · {d.config.aspectRatio} · {d.config.quality}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: () => <StatusBadge meta={VIDEO_STATUS_META.queued} />,
  },
  {
    id: 'created',
    header: 'Tạo lúc',
    cell: (d) => (
      <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
        {formatDateTime(d.createdAt)}
      </span>
    ),
  },
];

export function DashboardView({ systemStatus }: { systemStatus: React.ReactNode }) {
  const summary = useAsync(() => dashboardRepository.summary(), []);
  const drafts = useAsync(() => videoDraftRepository.list(), []);
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        icon={LayoutDashboard}
        description="Số liệu thật từ database: sản phẩm, tài nguyên, bản nháp sản xuất và hoạt động gần đây."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/products?action=new">Thêm sản phẩm</Link>
            </Button>
            <Button asChild>
              <Link href="/studio/videos">
                <Clapperboard /> Mở Xưởng video
              </Link>
            </Button>
          </>
        }
      />

      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : !s ? (
        <LoadingState variant="block" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
          <StatCard label="Sản phẩm" value={formatNumber(s.productCount)} icon={Package} />
          <StatCard
            label="Đang bán"
            value={formatNumber(s.activeProductCount)}
            icon={PackageCheck}
            tone="success"
          />
          <StatCard
            label="Hình ảnh"
            value={formatNumber(s.imageCount)}
            icon={ImageIcon}
            tone="info"
          />
          <StatCard
            label="Dung lượng media"
            value={formatBytes(s.mediaBytes)}
            icon={HardDrive}
            tone="neutral"
          />
          <StatCard
            label="Video đã dựng"
            value={formatNumber(s.videoCount)}
            hint="Dựng video ở Phase 06"
            icon={Clapperboard}
            tone="neutral"
          />
          <StatCard
            label="Luồng sản xuất nháp"
            value={formatNumber(s.videoDraftCount)}
            hint={`${s.batchCount} batch`}
            icon={Layers}
            tone="warning"
          />
          <StatCard
            label="Lịch đăng nháp"
            value={formatNumber(s.publishingDraftCount)}
            icon={CalendarClock}
            tone="processing"
          />
          <StatCard
            label="Kịch bản nháp"
            value={formatNumber(s.scriptDraftCount)}
            icon={FileText}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Sản phẩm mới theo ngày"
          description="14 ngày gần nhất · theo giờ Việt Nam"
        >
          {s ? (
            <VideosPerDayChart
              data={s.productsPerDay}
              label="Sản phẩm mới theo ngày"
              unit="sản phẩm"
            />
          ) : (
            <LoadingState variant="block" />
          )}
        </Panel>
        <Panel title="Hoạt động gần đây">
          {s ? <ActivityFeed items={s.recentActivity} /> : <LoadingState variant="block" />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Panel title="Quản lý nhanh">
            <QuickActions />
          </Panel>
          <Panel
            title="Luồng sản xuất nháp gần đây"
            aside={
              <Button variant="ghost" size="sm" asChild>
                <Link href="/studio/videos">Xem tất cả</Link>
              </Button>
            }
            bodyClassName="px-0 sm:px-0 pb-0"
          >
            <DataTable
              caption="Luồng sản xuất nháp gần đây"
              rows={(drafts.data ?? []).slice(0, 6)}
              columns={DRAFT_COLUMNS}
              getRowId={(d) => d.id}
              loading={drafts.loading && !drafts.data}
              error={drafts.error}
              onRetry={drafts.reload}
              minWidth={560}
              empty={
                <EmptyState title="Chưa có luồng sản xuất" description="Tạo luồng ở Xưởng video." />
              }
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">{systemStatus}</div>
      </div>
    </>
  );
}
