'use client';

import {
  CircleCheck,
  CircleX,
  Clapperboard,
  DollarSign,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Loader,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { VIDEO_JOB_STATUSES, type VideoJobStatus } from '@acs/shared';
import {
  DataTable,
  type DataTableColumn,
  DemoBadge,
  DemoNotice,
  EmptyState,
  ErrorState,
  LoadingState,
  MediaPreview,
  PageHeader,
  StatCard,
  StatusBadge,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/misc';
import { useAsync } from '@/hooks/use-async';
import { dashboardRepository, videoJobRepository } from '@/lib/data';
import { formatDateTime, formatNumber, formatUsd } from '@/lib/format';
import { VIDEO_STATUS_META } from '@/lib/labels';
import type { VideoJob } from '@/types/domain';
import { ActivityFeed } from './activity-feed';
import { Panel } from './panel';
import { QuickActions } from './quick-actions';
import { StatusDistribution } from './status-distribution';
import { VideosPerDayChart } from './videos-per-day-chart';

const RECENT_COLUMNS: DataTableColumn<VideoJob>[] = [
  {
    id: 'name',
    header: 'Tác vụ',
    cell: (job) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <MediaPreview image={job.images[0]} className="size-9" />
        <div className="min-w-0">
          <p className="max-w-64 truncate font-medium">{job.name}</p>
          <p className="text-muted-foreground text-xs">
            {job.durationSec}s · {job.aspectRatio} · {job.quality}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Trạng thái',
    cell: (job) => <StatusBadge meta={VIDEO_STATUS_META[job.status]} />,
  },
  {
    id: 'progress',
    header: 'Tiến độ',
    cell: (job) => (
      <div className="flex w-28 items-center gap-2">
        <Progress
          value={job.progress}
          tone={
            job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'success' : 'primary'
          }
        />
        <span className="tabular text-muted-foreground w-8 text-xs">{job.progress}%</span>
      </div>
    ),
  },
  {
    id: 'updated',
    header: 'Cập nhật',
    cell: (job) => (
      <span className="text-muted-foreground tabular text-xs whitespace-nowrap">
        {formatDateTime(job.updatedAt)}
      </span>
    ),
  },
];

export function DashboardView({ systemStatus }: { systemStatus: React.ReactNode }) {
  const summary = useAsync(() => dashboardRepository.summary(), []);
  const activities = useAsync(() => dashboardRepository.activities(), []);
  const recent = useAsync(() => dashboardRepository.recentJobs(), []);
  const jobs = useAsync(() => videoJobRepository.list(), []);

  const counts = Object.fromEntries(VIDEO_JOB_STATUSES.map((s) => [s, 0])) as Record<
    VideoJobStatus,
    number
  >;
  for (const job of jobs.data?.items ?? []) counts[job.status] += 1;

  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Tổng quan"
        icon={LayoutDashboard}
        description="Theo dõi sản lượng nội dung, tiến độ sản xuất và các hoạt động gần đây."
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

      <DemoNotice>
        Số liệu, biểu đồ và hoạt động bên dưới là <strong>dữ liệu DEMO</strong> để thiết kế giao
        diện – chưa có sản phẩm/video thật trong hệ thống. Riêng khối{' '}
        <strong>Trạng thái hệ thống</strong> là dữ liệu thật từ API.
      </DemoNotice>

      {summary.error ? (
        <ErrorState message={summary.error} onRetry={summary.reload} />
      ) : !s ? (
        <LoadingState variant="block" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
          <StatCard
            isDemo={s.isDemo}
            label="Sản phẩm"
            value={formatNumber(s.productCount)}
            icon={Package}
          />
          <StatCard
            isDemo={s.isDemo}
            label="Hình ảnh"
            value={formatNumber(s.imageCount)}
            icon={ImageIcon}
            tone="info"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Tổng video"
            value={formatNumber(s.videoCount)}
            icon={Clapperboard}
            tone="neutral"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Hoàn thành"
            value={formatNumber(s.videoCompleted)}
            icon={CircleCheck}
            tone="success"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Đang xử lý"
            value={formatNumber(s.videoProcessing)}
            icon={Loader}
            tone="processing"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Thất bại"
            value={formatNumber(s.videoFailed)}
            icon={CircleX}
            tone="danger"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Batch sản xuất"
            value={formatNumber(s.batchCount)}
            icon={Layers}
            tone="warning"
          />
          <StatCard
            isDemo={s.isDemo}
            label="Chi phí AI dự kiến"
            value={formatUsd(s.estimatedAiCostUsd)}
            hint="Ước tính – chưa có provider thật"
            icon={DollarSign}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Số video theo ngày"
          description="14 ngày gần nhất"
          aside={<DemoBadge />}
        >
          {s ? <VideosPerDayChart data={s.videosPerDay} /> : <LoadingState variant="block" />}
        </Panel>
        <Panel title="Sản lượng theo trạng thái" aside={<DemoBadge />}>
          {jobs.data ? <StatusDistribution counts={counts} /> : <LoadingState variant="block" />}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Panel title="Quản lý nhanh">
            <QuickActions />
          </Panel>
          <Panel
            title="Tác vụ gần đây"
            aside={
              <div className="flex items-center gap-2">
                <DemoBadge />
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/studio/videos">Xem tất cả</Link>
                </Button>
              </div>
            }
            bodyClassName="px-0 sm:px-0 pb-0"
          >
            <DataTable
              caption="Tác vụ gần đây"
              rows={recent.data ?? []}
              columns={RECENT_COLUMNS}
              getRowId={(j) => j.id}
              loading={recent.loading}
              error={recent.error}
              onRetry={recent.reload}
              minWidth={620}
              empty={<EmptyState title="Chưa có tác vụ nào" />}
            />
          </Panel>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {systemStatus}
          <Panel title="Hoạt động gần đây" aside={<DemoBadge />}>
            {activities.data ? (
              <ActivityFeed items={activities.data} />
            ) : (
              <LoadingState variant="block" />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
