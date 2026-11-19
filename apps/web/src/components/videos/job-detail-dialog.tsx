'use client';

import { Check, Download, RotateCw, X } from 'lucide-react';
import type { VideoJobStatus } from '@acs/shared';
import {
  DemoBadge,
  MediaPreview,
  StatusBadge,
  UnavailableButton,
  VideoPreview,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/misc';
import { templateName, voiceName } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { VIDEO_MODE_META, VIDEO_STATUS_META } from '@/lib/labels';
import type { VideoJob } from '@/types/domain';
import { cn } from '@/lib/utils';

const PIPELINE: VideoJobStatus[] = [
  'queued',
  'scripting',
  'voicing',
  'imaging',
  'rendering',
  'completed',
];

function Pipeline({ job }: { job: VideoJob }) {
  const failed = job.status === 'failed' || job.status === 'cancelled';
  // Với tác vụ lỗi: ước lượng bước đã dừng theo % tiến độ
  const reached = failed
    ? Math.min(PIPELINE.length - 2, Math.floor((job.progress / 100) * (PIPELINE.length - 1)))
    : PIPELINE.indexOf(job.status);

  return (
    <ol className="flex flex-col gap-0">
      {PIPELINE.map((step, i) => {
        const done = i < reached || (!failed && job.status === 'completed');
        const current = i === reached && !(job.status === 'completed');
        const broken = failed && i === reached;
        return (
          <li key={step} className="relative flex gap-3 pb-3 last:pb-0">
            {i < PIPELINE.length - 1 ? (
              <span
                className={cn(
                  'absolute top-6 bottom-0 left-[11px] w-px',
                  done ? 'bg-success' : 'bg-border',
                )}
                aria-hidden
              />
            ) : null}
            <span
              className={cn(
                'relative grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold',
                done && 'bg-success border-success text-white',
                current && !broken && 'border-primary bg-primary/15 text-[oklch(0.45_0.1_60)]',
                broken && 'bg-danger border-danger text-white',
              )}
            >
              {done ? <Check className="size-3.5" /> : broken ? <X className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                'pt-0.5 text-sm',
                current || broken ? 'font-medium' : 'text-muted-foreground',
              )}
            >
              {VIDEO_STATUS_META[step].label}
              {broken ? <span className="text-danger"> – dừng tại bước này</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function JobDetailDialog({
  job,
  onOpenChange,
}: {
  job: VideoJob | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(job)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {job ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base sm:text-lg">{job.name}</DialogTitle>
                {job.isLocalDraft ? (
                  <DemoBadge label="NHÁP CỤC BỘ" />
                ) : job.isDemo ? (
                  <DemoBadge />
                ) : null}
              </div>
              <DialogDescription>
                Tạo lúc {formatDateTime(job.createdAt)} · cập nhật {formatDateTime(job.updatedAt)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                <div className="mx-auto flex w-full max-w-60 flex-col gap-3">
                  <VideoPreview
                    src={job.resultUrl}
                    poster={job.thumbnail ?? job.images[0]}
                    aspect={job.aspectRatio}
                    emptyMessage={
                      job.isLocalDraft
                        ? 'Luồng nháp – chưa được gửi đi render'
                        : job.status === 'completed'
                          ? 'Dữ liệu DEMO – không có file video thật'
                          : 'Video chưa được tạo'
                    }
                  />
                  <div className="flex items-center gap-2">
                    <Progress
                      value={job.progress}
                      tone={
                        job.status === 'failed'
                          ? 'danger'
                          : job.status === 'completed'
                            ? 'success'
                            : 'primary'
                      }
                    />
                    <span className="tabular text-xs font-medium">{job.progress}%</span>
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge meta={VIDEO_STATUS_META[job.status]} />
                    {job.errorMessage ? (
                      <span className="text-danger text-sm">{job.errorMessage}</span>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                    {[
                      ['Sản phẩm', job.productName],
                      ['Tỷ lệ', job.aspectRatio],
                      ['Thời lượng', `${job.durationSec} giây`],
                      ['Chất lượng', job.quality],
                      ['Giọng đọc', voiceName(job.voiceId)],
                      ['Template', templateName(job.templateId)],
                      ['Chế độ', VIDEO_MODE_META[job.mode].label],
                      ['Batch', job.batchId],
                    ].map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-muted-foreground text-xs">{k}</dt>
                        <dd className="truncate font-medium" title={v}>
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div>
                    <p className="mb-1 text-xs font-medium">Prompt</p>
                    <p className="bg-muted/60 rounded-lg p-3 text-[13px] leading-relaxed">
                      {job.prompt}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium">
                      Ảnh tham chiếu ({job.images.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {job.images.map((img) => (
                        <MediaPreview key={img.id} image={img} className="size-14 border" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium">Các bước xử lý</p>
                    <Pipeline job={job} />
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <UnavailableButton
                variant="outline"
                reason="Chạy lại cần backend hàng đợi – dự kiến Phase 07"
              >
                <RotateCw /> Chạy lại
              </UnavailableButton>
              <UnavailableButton
                variant="outline"
                reason={
                  job.resultUrl
                    ? 'Tải xuống cần presigned URL – Phase 02'
                    : 'Chưa có file video để tải'
                }
              >
                <Download /> Tải video
              </UnavailableButton>
              <Button onClick={() => onOpenChange(false)}>Đóng</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
