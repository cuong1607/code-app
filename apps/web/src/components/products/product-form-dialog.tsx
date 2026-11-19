'use client';

import { Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PRODUCT_STATUSES, type ProductInput, productInputSchema } from '@acs/shared';
import { DemoNotice, Field, FileUpload, type LocalFile, MediaPreview } from '@/components/common';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { CATEGORIES } from '@/lib/data';
import { PRODUCT_STATUS_META } from '@/lib/labels';
import type { ImageRef, Product } from '@/types/domain';

type FormState = Omit<ProductInput, 'price'> & { price: string };
type Errors = Partial<Record<keyof ProductInput, string>>;

const EMPTY: FormState = {
  name: '',
  sku: '',
  category: '',
  price: '',
  status: 'draft',
  description: '',
  sourceUrl: '',
};

function toForm(product?: Product): FormState {
  if (!product) return EMPTY;
  return {
    name: product.name,
    sku: product.sku,
    category: product.categoryId,
    price: String(product.price),
    status: product.status,
    description: product.description ?? '',
    sourceUrl: product.sourceUrl ?? '',
  };
}

export interface ProductFormResult {
  input: ProductInput;
  images: ImageRef[];
}

/**
 * Form thêm/sửa sản phẩm. Validate bằng `productInputSchema` dùng chung với API.
 * Phase 01: kết quả chỉ trả về cho trang dưới dạng bản nháp cục bộ, KHÔNG lưu database.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  onSubmit: (result: ProductFormResult) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [errors, setErrors] = useState<Errors>({});
  const [images, setImages] = useState<ImageRef[]>(() => product?.images ?? []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as keyof ProductInput]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const addFiles = (files: LocalFile[]) => {
    setImages((prev) => {
      const next = [
        ...prev,
        ...files.map((f) => ({
          id: f.id,
          url: f.previewUrl,
          hue: 30,
          label: f.file.name,
          isPrimary: false,
        })),
      ];
      if (!next.some((img) => img.isPrimary) && next[0]) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const price = form.price.trim() === '' ? Number.NaN : Number(form.price.replace(/[.\s]/g, ''));
    const parsed = productInputSchema.safeParse({ ...form, price });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProductInput;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    onSubmit({ input: parsed.data, images });
    onOpenChange(false);
  };

  const isEdit = Boolean(product);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
          <DialogDescription>Các trường có dấu * là bắt buộc.</DialogDescription>
        </DialogHeader>
        <form id="product-form" onSubmit={submit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-4 pb-1">
            <DemoNotice tone="info">
              Phase 01 chưa có backend: bấm Lưu sẽ tạo <strong>bản nháp trong trình duyệt</strong>{' '}
              (mất khi tải lại trang), <strong>chưa lưu vào database</strong>. Ảnh chỉ được xem
              trước, chưa tải lên máy chủ.
            </DemoNotice>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Tên sản phẩm"
                htmlFor="p-name"
                required
                error={errors.name}
                className="sm:col-span-2"
              >
                <Input
                  id="p-name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  placeholder="VD: Áo thun cotton oversize"
                  autoFocus
                />
              </Field>
              <Field
                label="SKU"
                htmlFor="p-sku"
                required
                error={errors.sku}
                hint="Chữ, số, dấu - hoặc _"
              >
                <Input
                  id="p-sku"
                  value={form.sku}
                  onChange={(e) => set('sku', e.target.value.toUpperCase())}
                  aria-invalid={Boolean(errors.sku)}
                  placeholder="TH-1001"
                />
              </Field>
              <Field label="Danh mục" htmlFor="p-category" required error={errors.category}>
                <NativeSelect
                  id="p-category"
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  aria-invalid={Boolean(errors.category)}
                  placeholder="Chọn danh mục"
                  options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
              <Field label="Giá bán (VND)" htmlFor="p-price" required error={errors.price}>
                <Input
                  id="p-price"
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  aria-invalid={Boolean(errors.price)}
                  placeholder="199000"
                />
              </Field>
              <Field label="Trạng thái" htmlFor="p-status">
                <NativeSelect
                  id="p-status"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value as FormState['status'])}
                  options={PRODUCT_STATUSES.map((s) => ({
                    value: s,
                    label: PRODUCT_STATUS_META[s].label,
                  }))}
                />
              </Field>
              <Field
                label="Link sản phẩm gốc"
                htmlFor="p-url"
                error={errors.sourceUrl}
                className="sm:col-span-2"
              >
                <Input
                  id="p-url"
                  type="url"
                  value={form.sourceUrl}
                  onChange={(e) => set('sourceUrl', e.target.value)}
                  aria-invalid={Boolean(errors.sourceUrl)}
                  placeholder="https://…"
                />
              </Field>
              <Field
                label="Mô tả"
                htmlFor="p-desc"
                error={errors.description}
                className="sm:col-span-2"
              >
                <Textarea
                  id="p-desc"
                  rows={3}
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Điểm nổi bật, chất liệu, kích thước…"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Hình ảnh ({images.length})</p>
              {images.length ? (
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {images.map((img) => (
                    <li key={img.id} className="group relative">
                      <MediaPreview image={img} className="w-full rounded-lg border" />
                      {img.isPrimary ? (
                        <span className="bg-sidebar text-sidebar-primary absolute top-1 left-1 rounded px-1 text-[10px] font-semibold">
                          Ảnh chính
                        </span>
                      ) : null}
                      <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                        <Button
                          size="icon-xs"
                          variant="secondary"
                          aria-label="Đặt làm ảnh chính"
                          onClick={() =>
                            setImages((prev) =>
                              prev.map((p) => ({ ...p, isPrimary: p.id === img.id })),
                            )
                          }
                        >
                          <Star />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="secondary"
                          aria-label="Bỏ ảnh"
                          onClick={() => setImages((prev) => prev.filter((p) => p.id !== img.id))}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              <FileUpload onFiles={addFiles} compact />
            </div>
          </DialogBody>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button type="submit" form="product-form">
            {isEdit ? 'Lưu thay đổi (nháp)' : 'Lưu bản nháp'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
