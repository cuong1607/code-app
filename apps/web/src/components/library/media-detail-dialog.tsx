'use client';

import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { MediaAsset } from '@acs/shared';
import { MediaPreview } from '@/components/common';
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
import { describeError } from '@/lib/api/client';
import { mediaRepository } from '@/lib/data';
import { formatBytes, formatDateTime } from '@/lib/format';
import { MEDIA_KIND_LABEL, MEDIA_SOURCE_LABEL } from '@/lib/labels';
import { assetToImageRef } from '@/types/domain';

/** Tải file thật: xin URL tải xuống (presigned, có tên file) rồi điều hướng trình duyệt tới đó. */
export async function downloadAsset(asset: Pick<MediaAsset, 'id' | 'filename'>) {
  try {
    const { url } = await mediaRepository.downloadUrl(asset.id);
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (error) {
    toast.error(`Không tải được "${asset.filename}"`, { description: describeError(error) });
  }
}

export function MediaDetailDialog({
  asset,
  onOpenChange,
  onDelete,
}: {
  asset: MediaAsset | undefined;
  onOpenChange: (open: boolean) => void;
  onDelete: (asset: MediaAsset) => void;
}) {
  const [downloading, setDownloading] = useState(false);
  return (
    <Dialog open={Boolean(asset)} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {asset ? (
          <>
            <DialogHeader>
              <DialogTitle className="break-all">{asset.filename}</DialogTitle>
              <DialogDescription>{MEDIA_KIND_LABEL[asset.assetType]}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
                <MediaPreview
                  image={assetToImageRef(asset)}
                  aspect={
                    asset.width && asset.height && asset.height > asset.width * 1.3 ? '9:16' : '1:1'
                  }
                  className="bg-checker mx-auto w-full max-w-60 rounded-lg border"
                  alt={asset.filename}
                />
                <dl className="grid grid-cols-[7.5rem_1fr] content-start gap-x-3 gap-y-2.5 text-sm">
                  <dt className="text-muted-foreground">Tên gốc</dt>
                  <dd className="break-all">{asset.originalFilename}</dd>
                  <dt className="text-muted-foreground">Loại file</dt>
                  <dd className="font-mono text-xs">{asset.mimeType}</dd>
                  <dt className="text-muted-foreground">Dung lượng</dt>
                  <dd className="tabular">{formatBytes(asset.fileSize)}</dd>
                  {asset.width ? (
                    <>
                      <dt className="text-muted-foreground">Kích thước</dt>
                      <dd className="tabular">
                        {asset.width} × {asset.height} px
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Nguồn</dt>
                  <dd>{MEDIA_SOURCE_LABEL[asset.sourceType]}</dd>
                  <dt className="text-muted-foreground">Dùng bởi</dt>
                  <dd>{asset.linkedProductCount} sản phẩm</dd>
                  <dt className="text-muted-foreground">SHA-256</dt>
                  <dd className="truncate font-mono text-[11px]" title={asset.sha256}>
                    {asset.sha256}
                  </dd>
                  <dt className="text-muted-foreground">Ngày tạo</dt>
                  <dd className="tabular">{formatDateTime(asset.createdAt)}</dd>
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
              <Button
                variant="outline"
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  await downloadAsset(asset);
                  setDownloading(false);
                }}
              >
                <Download /> {downloading ? 'Đang chuẩn bị…' : 'Tải xuống'}
              </Button>
              <Button onClick={() => onOpenChange(false)}>Đóng</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
