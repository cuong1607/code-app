'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import {
  CURRENCIES,
  PRODUCT_STATUSES,
  type Product,
  type ProductDetail,
  parseMoney,
  productInputSchema,
} from '@acs/shared';
import { Field } from '@/components/common';
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
import { describeError } from '@/lib/api/client';
import { fieldErrorsFrom, productRepository } from '@/lib/data';
import { PRODUCT_STATUS_META } from '@/lib/labels';

interface FormState {
  name: string;
  sku: string;
  category: string;
  brand: string;
  costPrice: string;
  sellingPrice: string;
  currency: (typeof CURRENCIES)[number];
  status: (typeof PRODUCT_STATUSES)[number];
  sourceUrl: string;
  description: string;
  attributes: { key: string; value: string }[];
}

/** "199.000" -> 199000, "19.99" -> 19.99, "" -> null, chữ -> NaN (để schema báo lỗi). */
const num = (s: string): number | null => (s.trim() === '' ? null : (parseMoney(s) ?? Number.NaN));
const show = (v: string | null | undefined) => (v ? String(Number(v)) : '');

function toForm(p?: Product): FormState {
  return {
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    category: p?.category ?? '',
    brand: p?.brand ?? '',
    costPrice: show(p?.costPrice),
    sellingPrice: show(p?.sellingPrice),
    currency: p?.currency ?? 'VND',
    status: p?.status ?? 'draft',
    sourceUrl: p?.sourceUrl ?? '',
    description: p?.description ?? '',
    attributes: Object.entries(p?.attributes ?? {}).map(([key, value]) => ({ key, value })),
  };
}

/**
 * Form thêm/sửa sản phẩm – LƯU VÀO DATABASE qua API.
 * Kiểm tra tức thì bằng `productInputSchema` (dùng chung với API); lỗi từ server (VD: SKU trùng)
 * được hiển thị đúng trường.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  categories: string[];
  onSaved: (product: ProductDetail, created: boolean) => void;
}) {
  const listId = useId();
  const [form, setForm] = useState<FormState>(() => toForm(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(product);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(undefined);
    const attributes = Object.fromEntries(
      form.attributes.filter((a) => a.key.trim()).map((a) => [a.key.trim(), a.value.trim()]),
    );
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      brand: form.brand,
      description: form.description,
      costPrice: num(form.costPrice),
      sellingPrice: num(form.sellingPrice) ?? Number.NaN,
      currency: form.currency,
      status: form.status,
      sourceUrl: form.sourceUrl,
      attributes,
    };
    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key])
          next[key] =
            key === 'sellingPrice' && !form.sellingPrice ? 'Vui lòng nhập giá bán' : issue.message;
      }
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const saved = product
        ? await productRepository.update(product.id, payload)
        : await productRepository.create(payload);
      onSaved(saved, !product);
      onOpenChange(false);
    } catch (error) {
      const fields = fieldErrorsFrom(error);
      if (Object.keys(fields).length) setErrors(fields);
      setFormError(describeError(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
          <DialogDescription>
            Các trường có dấu * là bắt buộc.{' '}
            {isEdit ? '' : 'Ảnh sản phẩm được thêm ở trang chi tiết sau khi lưu.'}
          </DialogDescription>
        </DialogHeader>
        <form id="product-form" onSubmit={submit} noValidate className="contents">
          <DialogBody className="flex flex-col gap-4 pb-1">
            {formError ? (
              <p
                role="alert"
                className="border-danger/30 bg-danger/8 text-danger rounded-lg border px-3 py-2 text-sm"
              >
                {formError}
              </p>
            ) : null}
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
                hint="Chữ, số, dấu - hoặc _ (tự chuyển IN HOA)"
              >
                <Input
                  id="p-sku"
                  value={form.sku}
                  onChange={(e) => set('sku', e.target.value.toUpperCase())}
                  aria-invalid={Boolean(errors.sku)}
                  placeholder="TT-1001"
                />
              </Field>
              <Field
                label="Danh mục"
                htmlFor="p-category"
                required
                error={errors.category}
                hint="Chọn có sẵn hoặc nhập danh mục mới"
              >
                <Input
                  id="p-category"
                  list={listId}
                  value={form.category}
                  onChange={(e) => set('category', e.target.value)}
                  aria-invalid={Boolean(errors.category)}
                  placeholder="VD: Thời trang"
                />
                <datalist id={listId}>
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Thương hiệu" htmlFor="p-brand" error={errors.brand}>
                <Input
                  id="p-brand"
                  value={form.brand}
                  onChange={(e) => set('brand', e.target.value)}
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
              <Field label="Giá vốn" htmlFor="p-cost" error={errors.costPrice}>
                <Input
                  id="p-cost"
                  inputMode="decimal"
                  value={form.costPrice}
                  onChange={(e) => set('costPrice', e.target.value)}
                  aria-invalid={Boolean(errors.costPrice)}
                  placeholder="90000"
                />
              </Field>
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <Field label="Giá bán" htmlFor="p-price" required error={errors.sellingPrice}>
                  <Input
                    id="p-price"
                    inputMode="decimal"
                    value={form.sellingPrice}
                    onChange={(e) => set('sellingPrice', e.target.value)}
                    aria-invalid={Boolean(errors.sellingPrice)}
                    placeholder="199000"
                  />
                </Field>
                <Field label="Tiền tệ" htmlFor="p-currency">
                  <NativeSelect
                    id="p-currency"
                    value={form.currency}
                    onChange={(e) => set('currency', e.target.value as FormState['currency'])}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
              </div>
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

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                Thông số (màu sắc, kích thước, chất liệu…)
              </legend>
              {form.attributes.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] gap-2">
                  <Input
                    aria-label={`Tên thông số ${i + 1}`}
                    value={a.key}
                    placeholder="Màu sắc"
                    onChange={(e) =>
                      set(
                        'attributes',
                        form.attributes.map((x, j) =>
                          j === i ? { ...x, key: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={`Giá trị thông số ${i + 1}`}
                    value={a.value}
                    placeholder="Trắng, Đen"
                    onChange={(e) =>
                      set(
                        'attributes',
                        form.attributes.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Xoá thông số"
                    onClick={() =>
                      set(
                        'attributes',
                        form.attributes.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {errors.attributes ? (
                <p className="text-danger text-xs">{errors.attributes}</p>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="self-start"
                onClick={() => set('attributes', [...form.attributes, { key: '', value: '' }])}
                disabled={form.attributes.length >= 30}
              >
                <Plus /> Thêm thông số
              </Button>
            </fieldset>
          </DialogBody>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="product-form" disabled={saving}>
            {saving ? 'Đang lưu…' : isEdit ? 'Lưu thay đổi' : 'Lưu sản phẩm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
