'use client';

import { Columns2, Download, FolderPlus, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import {
  DemoBadge,
  MediaPreview,
  type PreviewAspect,
  UnavailableButton,
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
import type { ImageRef } from '@/types/domain';

/** Xem ảnh lớn + chế độ so sánh ảnh gốc / ảnh tạo. */
export function ImageViewerDialog({
  image,
  original,
  aspect,
  onOpenChange,
}: {
  image: ImageRef | undefined;
  original?: ImageRef;
  aspect: PreviewAspect;
  onOpenChange: (open: boolean) => void;
}) {
  const [compare, setCompare] = useState(false);
  return (
    <Dialog open={Boolean(image)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {image ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{image.label ?? 'Ảnh'}</DialogTitle>
                <DemoBadge label="KHUNG MẪU – KHÔNG PHẢI ẢNH AI" />
              </div>
              <DialogDescription>
                Tỷ lệ {aspect}. Ảnh thật sẽ hiển thị ở đây khi có image provider (Phase 04).
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              {compare ? (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Ảnh gốc', img: original },
                    { label: 'Ảnh tạo', img: image },
                  ].map(({ label, img }) => (
                    <figure key={label} className="flex flex-col gap-1.5">
                      <figcaption className="text-xs font-medium">{label}</figcaption>
                      {img ? (
                        <MediaPreview
                          image={img}
                          aspect={aspect}
                          className="bg-checker w-full rounded-lg border"
                        />
                      ) : (
                        <div className="bg-muted text-muted-foreground grid aspect-square place-items-center rounded-lg border p-4 text-center text-xs">
                          Chưa có ảnh gốc – chọn sản phẩm hoặc tải ảnh tham chiếu
                        </div>
                      )}
                    </figure>
                  ))}
                </div>
              ) : (
                <MediaPreview
                  image={image}
                  aspect={aspect}
                  className="bg-checker mx-auto w-full max-w-md rounded-lg border"
                />
              )}
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompare((v) => !v)}>
                {compare ? <Maximize2 /> : <Columns2 />}{' '}
                {compare ? 'Xem một ảnh' : 'So sánh với ảnh gốc'}
              </Button>
              <UnavailableButton
                variant="outline"
                reason="Không có file thật để tải – cần image provider (Phase 04)"
              >
                <Download /> Tải xuống
              </UnavailableButton>
              <UnavailableButton reason="Lưu vào thư viện cần storage API – dự kiến Phase 02/04">
                <FolderPlus /> Lưu vào thư viện
              </UnavailableButton>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
