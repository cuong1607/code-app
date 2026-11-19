'use client';

import { ExternalLink, Pencil } from 'lucide-react';
import { useState } from 'react';
import { DemoBadge, MediaPreview, StatusBadge } from '@/components/common';
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
import { categoryName } from '@/lib/data';
import { formatDateTime, formatVnd } from '@/lib/format';
import { PRODUCT_STATUS_META } from '@/lib/labels';
import type { Product } from '@/types/domain';
import { cn } from '@/lib/utils';

export function ProductDetailDialog({
  product,
  onOpenChange,
  onEdit,
}: {
  product: Product | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (product: Product) => void;
}) {
  const [activeId, setActiveId] = useState<string>();
  const active =
    product?.images.find((i) => i.id === activeId) ??
    product?.images.find((i) => i.isPrimary) ??
    product?.images[0];

  return (
    <Dialog open={Boolean(product)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {product ? (
          <>
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{product.name}</DialogTitle>
                {product.isLocalDraft ? (
                  <DemoBadge label="NHÁP CỤC BỘ" />
                ) : product.isDemo ? (
                  <DemoBadge />
                ) : null}
              </div>
              <DialogDescription>
                SKU {product.sku} · {categoryName(product.categoryId)}
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="flex flex-col gap-2">
                  <MediaPreview
                    image={active}
                    className="w-full rounded-xl border"
                    alt={product.name}
                  />
                  {product.images.length > 1 ? (
                    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
                      {product.images.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setActiveId(img.id)}
                          aria-label={`Xem ${img.label ?? 'ảnh'}`}
                          className={cn(
                            'shrink-0 cursor-pointer rounded-lg border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                            img.id === active?.id ? 'border-primary' : 'border-transparent',
                          )}
                        >
                          <MediaPreview image={img} className="size-14" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <dl className="grid grid-cols-[8rem_1fr] content-start gap-x-4 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Giá bán</dt>
                  <dd className="tabular font-semibold">{formatVnd(product.price)}</dd>
                  <dt className="text-muted-foreground">Trạng thái</dt>
                  <dd>
                    <StatusBadge meta={PRODUCT_STATUS_META[product.status]} />
                  </dd>
                  <dt className="text-muted-foreground">Số ảnh</dt>
                  <dd className="tabular">{product.images.length}</dd>
                  <dt className="text-muted-foreground">Ngày tạo</dt>
                  <dd className="tabular">{formatDateTime(product.createdAt)}</dd>
                  <dt className="text-muted-foreground">Link gốc</dt>
                  <dd className="min-w-0">
                    {product.sourceUrl ? (
                      <a
                        href={product.sourceUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-info inline-flex max-w-full items-center gap-1 truncate hover:underline"
                      >
                        <span className="truncate">{product.sourceUrl}</span>
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Mô tả</dt>
                  <dd className="leading-relaxed whitespace-pre-line">
                    {product.description || '—'}
                  </dd>
                </dl>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Đóng
              </Button>
              <Button onClick={() => onEdit(product)}>
                <Pencil /> Chỉnh sửa
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
