'use client';

import { Download, Trash2 } from 'lucide-react';
import { DemoBadge, MediaPreview, UnavailableButton, VideoPreview } from '@/components/common';
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
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format';
import { MEDIA_KIND_LABEL } from '@/lib/labels';
import type { MediaAsset } from '@/types/domain';

export function MediaDetailDialog({
  asset,
  onOpenChange,
  onDelete,
}: {
  asset: MediaAsset | undefined;
  onOpenChange: (open: boolean) => void;
  onDelete: (asset: MediaAsset) => void;
}) {
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {asset ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="break-all">{asset.name}</DialogTitle>
                <DemoBadge />
              </div>
              <DialogDescription>{MEDIA_KIND_LABEL[asset.kind]}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                {asset.kind === 'video' ? (
                  <VideoPreview
                    poster={asset.preview}
                    emptyMessage="DEMO – không có file video thật"
                    className="mx-auto max-w-56"
                  />
                ) : (
                  <MediaPreview
                    image={asset.preview}
                    kind={asset.kind === 'audio' ? 'audio' : 'image'}
                    aspect={asset.kind === 'thumbnail' ? '9:16' : '1:1'}
                    className="bg-checker mx-auto w-full max-w-56 rounded-lg border"
                  />
                )}
                <dl className="grid grid-cols-[7.5rem_1fr] content-start gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Loại file</dt>
                  <dd className="font-mono text-xs">{asset.mimeType}</dd>
                  <dt className="text-muted-foreground">Dung lượng</dt>
                  <dd className="tabular">{formatBytes(asset.sizeBytes)}</dd>
                  {asset.width ? (
                    <>
                      <dt className="text-muted-foreground">Kích thước</dt>
                      <dd className="tabular">
                        {asset.width} × {asset.height} px
                      </dd>
                    </>
                  ) : null}
                  {asset.durationSec ? (
                    <>
                      <dt className="text-muted-foreground">Thời lượng</dt>
                      <dd className="tabular">{formatDuration(asset.durationSec)}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Ngày tạo</dt>
                  <dd className="tabular">{formatDateTime(asset.createdAt)}</dd>
                  <dt className="text-muted-foreground">Lưu trữ</dt>
                  <dd className="text-muted-foreground text-xs">
                    Dữ liệu DEMO – chưa có file trong MinIO
                  </dd>
                </dl>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="ghost"
                className="text-danger mr-auto"
                onClick={() => onDelete(asset)}
              >
                <Trash2 /> Xoá
              </Button>
              <UnavailableButton
                variant="outline"
                reason="Tải xuống cần presigned URL từ storage API – dự kiến Phase 02"
              >
                <Download /> Tải xuống
              </UnavailableButton>
              <Button onClick={() => onOpenChange(false)}>Đóng</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
