'use client';

import { useState } from 'react';
import type { Product } from '@acs/shared';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MediaPreview,
  SearchInput,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { productRepository } from '@/lib/data';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hueFromString } from '@/types/domain';

/** Hộp thoại chọn sản phẩm THẬT từ database (tìm kiếm phía server). */
export function ProductPickerDialog({
  open,
  onOpenChange,
  initial,
  onConfirm,
  title = 'Chọn sản phẩm',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: readonly Product[];
  onConfirm: (products: Product[]) => void;
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const products = useAsync(() => productRepository.options(debounced || undefined), [debounced]);
  const [picked, setPicked] = useState<Map<string, Product>>(
    () => new Map(initial.map((p) => [p.id, p])),
  );

  const toggle = (p: Product) =>
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) next.delete(p.id);
      else next.set(p.id, p);
      return next;
    });

  const list = products.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Sản phẩm trong database (không gồm sản phẩm đã lưu trữ).
          </DialogDescription>
        </DialogHeader>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm sản phẩm…"
          className="sm:w-full"
        />
        <DialogBody className="max-h-[50vh]">
          {products.error ? (
            <ErrorState message={products.error} onRetry={products.reload} />
          ) : products.loading && !products.data ? (
            <LoadingState rows={5} />
          ) : list.length === 0 ? (
            <EmptyState
              title={search ? 'Không có sản phẩm phù hợp' : 'Chưa có sản phẩm'}
              description={search ? undefined : 'Thêm sản phẩm ở trang Sản phẩm.'}
            />
          ) : (
            <ul className="flex flex-col gap-1" aria-label="Sản phẩm">
              {list.map((p) => {
                const checked = picked.has(p.id);
                return (
                  <li key={p.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors',
                        checked
                          ? 'border-primary bg-primary/8'
                          : 'border-transparent hover:bg-accent/60',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(p)}
                        aria-label={`Chọn ${p.name}`}
                      />
                      <MediaPreview
                        image={{
                          id: p.id,
                          url: p.primaryImage?.previewUrl ?? undefined,
                          hue: hueFromString(p.id),
                        }}
                        className="size-10"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {p.sku} · {p.category} · {p.imageCount} ảnh
                        </span>
                      </span>
                      <span className="tabular text-muted-foreground hidden text-xs sm:block">
                        {formatMoney(p.sellingPrice, p.currency)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <span className="text-muted-foreground mr-auto text-sm">Đã chọn {picked.size}</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              onConfirm([...picked.values()]);
              onOpenChange(false);
            }}
          >
            Xác nhận
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
