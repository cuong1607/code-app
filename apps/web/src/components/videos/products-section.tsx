'use client';

import { PackagePlus, Star, X } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, FileUpload, MediaPreview, SectionCard } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProductPickerDialog } from './product-picker-dialog';
import type { VideoFactoryState } from './use-video-factory';

/** Khu vực 3: Sản phẩm & ảnh tham chiếu. */
export function ProductsSection({ state }: { state: VideoFactoryState }) {
  const { selected, setProducts, removeProduct, setPrimaryImage, removeImage, addImages } = state;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <SectionCard
      step={3}
      title="Sản phẩm & ảnh tham chiếu"
      aside={
        <Badge variant={selected.length ? 'default' : 'secondary'} className="tabular">
          {selected.length} đã chọn
        </Badge>
      }
    >
      <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
        <PackagePlus /> {selected.length ? 'Thay đổi danh sách sản phẩm' : 'Chọn sản phẩm'}
      </Button>

      {selected.length === 0 ? (
        <EmptyState
          className="py-6"
          title="Chưa chọn sản phẩm"
          description="Chọn một hoặc nhiều sản phẩm để tạo luồng sản xuất."
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {selected.map(({ product, images, primaryImageId }) => (
            <li key={product.id} className="rounded-lg border p-2.5">
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{product.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {product.sku} · {images.length} ảnh được chọn
                  </p>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removeProduct(product.id)}
                  aria-label={`Bỏ ${product.name} khỏi batch`}
                >
                  <X />
                </Button>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {images.map((img) => {
                  const primary = img.id === primaryImageId;
                  return (
                    <li key={img.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setPrimaryImage(product.id, img.id)}
                        aria-label={
                          primary
                            ? `${img.label ?? 'Ảnh'} – ảnh chính`
                            : `Đặt ${img.label ?? 'ảnh'} làm ảnh chính`
                        }
                        aria-pressed={primary}
                        className={cn(
                          'block cursor-pointer rounded-md border-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                          primary ? 'border-primary' : 'border-transparent hover:border-primary/40',
                        )}
                      >
                        <MediaPreview image={img} className="size-12" />
                      </button>
                      {primary ? (
                        <Star
                          className="fill-primary text-primary pointer-events-none absolute top-0.5 left-0.5 size-3 drop-shadow"
                          aria-hidden
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeImage(product.id, img.id)}
                        aria-label={`Xoá ${img.label ?? 'ảnh'} khỏi lựa chọn`}
                        className="bg-sidebar text-sidebar-foreground absolute -top-1.5 -right-1.5 grid size-4 cursor-pointer place-items-center rounded-full opacity-100 shadow sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                      >
                        <X className="size-2.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <FileUpload
                compact
                className="mt-2"
                label="Thêm ảnh tham chiếu"
                hint="Chỉ xem trước trên trình duyệt"
                onFiles={(files) =>
                  addImages(
                    product.id,
                    files.map((f) => ({
                      id: f.id,
                      url: f.previewUrl,
                      hue: 30,
                      label: f.file.name,
                    })),
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}

      {pickerOpen ? (
        <ProductPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          initialIds={selected.map((s) => s.product.id)}
          onConfirm={setProducts}
          title="Chọn sản phẩm cho batch"
        />
      ) : null}
    </SectionCard>
  );
}
