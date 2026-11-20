'use client';

import {
  Ban,
  Check,
  Clapperboard,
  Columns2,
  Download,
  History,
  ImageIcon,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDisplayDateTime, type ImageItem } from '@acs/shared';
import { ConfirmDialog, DemoBadge, EmptyState, ErrorState, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { IMAGE_APPROVAL_META, IMAGE_JOB_STATUS_META, IMAGE_STAGE_LABEL } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { ImageReviewDialog } from './image-review-dialog';
import type { ImageStudioState } from './use-image-studio';

const ASPECT_CLASS = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-video',
} as const;

function JobList({ s }: { s: ImageStudioState }) {
  if (s.jobsError) return <ErrorState message={s.jobsError} onRetry={s.reloadJobs} />;
  if (s.jobsLoading) return <p className="text-muted-foreground text-xs">Đang tải tác vụ…</p>;
  if (!s.jobs.length) return <p className="text-muted-foreground text-xs">Chưa có tác vụ nào.</p>;
  return (
    <ul className="flex flex-col gap-1" aria-label="Danh sách tác vụ">
      {s.jobs.map((j) => (
        <li key={j.id}>
          <button
            type="button"
            onClick={() => void s.openJob(j.id)}
            aria-current={s.job?.id === j.id}
            className={cn(
              'flex w-full cursor-pointer flex-col gap-0.5 rounded-lg border p-2 text-left text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
              s.job?.id === j.id ? 'border-primary bg-primary/10' : 'hover:bg-accent/60',
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate font-medium">{j.productName}</span>
              <StatusBadge meta={IMAGE_JOB_STATUS_META[j.status]} />
            </span>
            <span className="text-muted-foreground truncate">
              {j.templateName} · {j.aspect} · {j.counts.completed}/{j.counts.total} ảnh
              {j.isMock ? ' · MOCK' : ''}
            </span>
            <span className="text-muted-foreground">{formatDisplayDateTime(j.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ItemCard({
  s,
  item,
  aspect,
  onOpen,
}: {
  s: ImageStudioState;
  item: ImageItem;
  aspect: keyof typeof ASPECT_CLASS;
  onOpen: () => void;
}) {
  const active = ['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(item.status);
  const done = item.status === 'COMPLETED' && !!item.asset;
  const colorLow = item.autoCheck?.flags.includes('color_low');
  const busy = s.busy?.endsWith(item.id) ?? false;
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border p-1.5" data-testid="image-item">
      <button
        type="button"
        onClick={onOpen}
        disabled={!done && item.status !== 'FAILED'}
        aria-label={`Xem và so sánh ảnh ${item.index + 1}`}
        className={cn(
          'relative block w-full cursor-pointer overflow-hidden rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default',
          ASPECT_CLASS[aspect],
        )}
      >
        {done && item.asset?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL presigned từ MinIO
          <img
            src={item.asset.previewUrl}
            alt={`Ảnh ${item.index + 1}`}
            className="bg-checker size-full object-contain"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center text-xs">
            {active ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : item.status === 'FAILED' ? (
              <TriangleAlert className="text-danger size-5" aria-hidden />
            ) : (
              <Ban className="size-5" aria-hidden />
            )}
            <span>{IMAGE_STAGE_LABEL[item.stage]}</span>
            {item.errorMessage ? (
              <span className="text-[11px] leading-snug">{item.errorMessage}</span>
            ) : null}
          </div>
        )}
        {done ? (
          <span className="bg-card/90 absolute top-1.5 left-1.5 rounded">
            <StatusBadge meta={IMAGE_APPROVAL_META[item.approvalStatus]} />
          </span>
        ) : null}
        {colorLow ? (
          <span className="bg-danger/90 text-white absolute top-1.5 right-1.5 rounded px-1 text-[10px] font-medium">
            Màu lệch?
          </span>
        ) : null}
      </button>
      <div className="flex flex-wrap items-center gap-1 px-0.5">
        <span className="text-muted-foreground mr-auto text-[11px]">
          #{item.index + 1}
          {item.regeneratedFromId ? ' · tạo lại' : ''}
          {item.autoCheck?.fit.mode === 'pad' ? ' · có viền' : ''}
        </span>
        {done ? (
          <>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`So sánh ảnh ${item.index + 1}`}
              title="So sánh với ảnh gốc"
              onClick={onOpen}
            >
              <Columns2 />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Duyệt ảnh ${item.index + 1}`}
              title="Duyệt"
              disabled={busy || item.approvalStatus === 'approved'}
              onClick={() => void s.approve(item.id)}
            >
              <Check />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Từ chối ảnh ${item.index + 1}`}
              title="Từ chối"
              disabled={busy || item.approvalStatus === 'rejected'}
              onClick={() => void s.reject(item.id)}
            >
              <X />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Tải ảnh ${item.index + 1}`}
              title="Tải xuống"
              onClick={() => void s.download(item.id)}
            >
              <Download />
            </Button>
          </>
        ) : null}
        {!active ? (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Tạo lại ảnh ${item.index + 1}`}
            title="Tạo lại"
            disabled={busy}
            onClick={() => void s.regenerate(item.id)}
          >
            <RefreshCw />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ImageResults({ s }: { s: ImageStudioState }) {
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const job = s.job;
  const approved = job?.items.filter((i) => i.approvalStatus === 'approved' && i.asset) ?? [];
  const usable = s.requireApproval
    ? approved
    : (job?.items.filter(
        (i) => i.status === 'COMPLETED' && i.asset && i.approvalStatus !== 'rejected',
      ) ?? []);
  const active = job && ['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(job.status);
  const videoHref =
    job?.productId && usable.length
      ? `/studio/videos?products=${job.productId}&images=${usable.map((i) => i.asset!.id).join(',')}`
      : null;

  return (
    <section aria-label="Kết quả" className="grid min-w-0 gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <div className="bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-3 shadow-xs">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <History className="size-4" aria-hidden /> Tác vụ gần đây
        </h2>
        <JobList s={s} />
      </div>

      <div className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-xs sm:p-5">
        {!job ? (
          <EmptyState
            icon={ImageIcon}
            className="py-20"
            title="Chưa có ảnh"
            description="Chọn sản phẩm, bối cảnh rồi bấm Tạo ảnh. Ảnh được xử lý nền và lưu vào MinIO."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">{job.productName}</h2>
              <StatusBadge meta={IMAGE_JOB_STATUS_META[job.status]} />
              {job.isMock ? <DemoBadge label="MOCK – KHÔNG PHẢI ẢNH AI" /> : null}
              {!job.usesAi ? <DemoBadge label="ẢNH GHÉP – KHÔNG PHẢI AI" /> : null}
              {active ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={s.busy === 'cancel'}
                  onClick={() => void s.cancel()}
                >
                  <Ban /> Huỷ tác vụ
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  disabled={s.busy === 'remove'}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Xoá tác vụ
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {job.templateName} (v{job.templateVersion}) · {job.aspect} · {job.provider}/
              {job.model} · {job.counts.completed} xong · {job.counts.failed} lỗi ·{' '}
              {job.counts.running + job.counts.queued} đang chờ · {job.counts.approved} đã duyệt ·
              chi phí ước tính{' '}
              {job.estimatedCostUsd === null ? '—' : `$${Number(job.estimatedCostUsd).toFixed(4)}`}
            </p>
            {job.errorMessage ? <p className="text-danger text-xs">{job.errorMessage}</p> : null}
            <ul
              className={cn(
                'grid gap-3',
                job.aspect === '16:9'
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4',
              )}
            >
              {job.items.map((item) => (
                <ItemCard
                  key={item.id}
                  s={s}
                  item={item}
                  aspect={job.aspect}
                  onOpen={() => setViewing(item.id)}
                />
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {videoHref ? (
                <Button asChild>
                  <Link href={videoHref}>
                    <Clapperboard /> Sử dụng làm ảnh đầu vào Video Factory ({usable.length})
                  </Link>
                </Button>
              ) : (
                <Button disabled>
                  <Clapperboard /> Sử dụng làm ảnh đầu vào Video Factory
                </Button>
              )}
              <span className="text-muted-foreground text-xs">
                {s.requireApproval
                  ? 'Chế độ kiểm duyệt đang bật: chỉ ảnh ĐÃ DUYỆT được dùng cho video.'
                  : 'Chế độ kiểm duyệt đang tắt: ảnh chưa bị từ chối đều dùng được.'}
              </span>
            </div>
          </>
        )}
      </div>
      <ImageReviewDialog
        s={s}
        itemId={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Xoá tác vụ tạo ảnh?"
        description="Ảnh chưa lưu thư viện và chưa gắn sản phẩm sẽ bị xoá khỏi MinIO. Ảnh đã lưu/gắn sản phẩm và ảnh gốc được giữ lại."
        confirmLabel="Xoá tác vụ"
        onConfirm={() => {
          setConfirmDelete(false);
          void s.removeJob();
        }}
      />
    </section>
  );
}
