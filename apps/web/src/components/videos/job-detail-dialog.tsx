'use client';

import { Check, Download, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { VideoDraft } from '@acs/shared';
import {
  Field,
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { describeError } from '@/lib/api/client';
import { templateName, videoDraftRepository, voiceName } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { VIDEO_MODE_META, VIDEO_STATUS_META } from '@/lib/labels';
import { hueFromString } from '@/types/domain';

const PIPELINE = ['queued', 'scripting', 'voicing', 'imaging', 'rendering', 'completed'] as const;

/** Chi tiết luồng nháp: xem cấu hình, preview (chưa có video), sửa tên & prompt (lưu DB). */
export function JobDetailDialog({
  job,
  onOpenChange,
  onSaved,
}: {
  job: VideoDraft | undefined;
  onOpenChange: (open: boolean) => void;
  onSaved: (draft: VideoDraft) => void;
}) {
  return (
    <Dialog open={Boolean(job)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {job ? (
          <Body key={job.id} job={job} onClose={() => onOpenChange(false)} onSaved={onSaved} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  job,
  onClose,
  onSaved,
}: {
  job: VideoDraft;
  onClose: () => void;
  onSaved: (d: VideoDraft) => void;
}) {
  const [name, setName] = useState(job.name);
  const [prompt, setPrompt] = useState(job.prompt);
  const [saving, setSaving] = useState(false);
  const dirty = name !== job.name || prompt !== job.prompt;

  const save = async () => {
    setSaving(true);
    try {
      const saved = await videoDraftRepository.update(job.id, { name, prompt });
      onSaved(saved);
      toast.success('Đã lưu thay đổi luồng nháp');
    } catch (error) {
      toast.error('Không lưu được', { description: describeError(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base sm:text-lg">{job.name}</DialogTitle>
        <DialogDescription>
          Batch {job.batchKey} · tạo lúc {formatDateTime(job.createdAt)} · cập nhật{' '}
          {formatDateTime(job.updatedAt)}
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div className="mx-auto flex w-full max-w-60 flex-col gap-3">
            <VideoPreview
              poster={
                job.images[0]
                  ? {
                      id: job.images[0].id,
                      url: job.images[0].previewUrl ?? undefined,
                      hue: hueFromString(job.id),
                    }
                  : undefined
              }
              aspect={job.config.aspectRatio}
              emptyMessage="Luồng nháp – chưa render (Phase 06/07)"
            />
            <StatusBadge meta={VIDEO_STATUS_META.queued} className="self-center" />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ['Sản phẩm', job.productName],
                ['Tỷ lệ', job.config.aspectRatio],
                ['Thời lượng', `${job.config.durationSec} giây`],
                ['Chất lượng', job.config.quality],
                ['Giọng đọc', voiceName(job.config.voiceId)],
                ['Template', templateName(job.config.templateId)],
                ['Chế độ', VIDEO_MODE_META[job.config.mode].label],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-muted-foreground text-xs">{k}</dt>
                  <dd className="truncate font-medium" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <Field label="Tên luồng" htmlFor="jd-name">
              <Input
                id="jd-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </Field>
            <Field label="Prompt" htmlFor="jd-prompt">
              <Textarea
                id="jd-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={4000}
              />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-medium">Ảnh tham chiếu ({job.images.length})</p>
              {job.images.length ? (
                <div className="flex flex-wrap gap-2">
                  {job.images.map((img) => (
                    <MediaPreview
                      key={img.id}
                      image={{
                        id: img.id,
                        url: img.previewUrl ?? undefined,
                        hue: hueFromString(img.id),
                        label: img.filename,
                      }}
                      className="size-14 border"
                      alt={img.filename}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Không có ảnh (hoặc ảnh đã bị xoá khỏi thư viện).
                </p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium">
                Các bước xử lý (sẽ chạy khi có worker render)
              </p>
              <ol className="flex flex-wrap gap-1.5">
                {PIPELINE.map((s, i) => (
                  <li
                    key={s}
                    className={
                      i === 0
                        ? 'bg-primary/15 rounded px-2 py-0.5 text-xs font-medium'
                        : 'bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs'
                    }
                  >
                    {i + 1}. {VIDEO_STATUS_META[s].label}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <UnavailableButton
          variant="outline"
          reason="Chạy luồng cần worker render – dự kiến Phase 07"
        >
          <RotateCw /> Chạy
        </UnavailableButton>
        <UnavailableButton variant="outline" reason="Chưa có file video – render ở Phase 06">
          <Download /> Tải video
        </UnavailableButton>
        {dirty ? (
          <Button onClick={() => void save()} disabled={saving || !name.trim() || !prompt.trim()}>
            <Check /> {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        ) : (
          <Button onClick={onClose}>Đóng</Button>
        )}
      </DialogFooter>
    </>
  );
}
