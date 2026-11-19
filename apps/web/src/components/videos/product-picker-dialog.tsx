'use client';

import { useMemo, useState } from 'react';
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
import { categoryName, productRepository } from '@/lib/data';
import { normalizeText } from '@/lib/data/query';
import { formatVnd } from '@/lib/format';
import type { Product } from '@/types/domain';
import { cn } from '@/lib/utils';

/** Hộp thoại chọn nhiều sản phẩm (dùng chung cho các studio). */
export function ProductPickerDialog({
  open,
  onOpenChange,
  initialIds,
  onConfirm,
  title = 'Chọn sản phẩm',
  single = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIds: readonly string[];
  onConfirm: (products: Product[]) => void;
  title?: string;
  single?: boolean;
}) {
  const products = useAsync(() => productRepository.options(), []);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(initialIds));

  const filtered = useMemo(() => {
    const term = normalizeText(search);
    return (products.data ?? []).filter(
      (p) =>
        !term || normalizeText(`${p.name} ${p.sku} ${categoryName(p.categoryId)}`).includes(term),
    );
  }, [products.data, search]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      if (single) return new Set([id]);
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Danh sách sản phẩm DEMO (không bao gồm sản phẩm đã lưu trữ).
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
          ) : products.loading ? (
            <LoadingState rows={5} />
          ) : filtered.length === 0 ? (
            <EmptyState title="Không có sản phẩm phù hợp" />
          ) : (
            <ul
              className="flex flex-col gap-1"
              role="listbox"
              aria-multiselectable={!single}
              aria-label="Sản phẩm"
            >
              {filtered.map((p) => {
                const checked = picked.has(p.id);
                return (
                  <li key={p.id} role="option" aria-selected={checked}>
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
                        onCheckedChange={() => toggle(p.id)}
                        aria-label={`Chọn ${p.name}`}
                      />
                      <MediaPreview image={p.images[0]} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="text-muted-foreground block text-xs">
                          {p.sku} · {categoryName(p.categoryId)} · {p.images.length} ảnh
                        </span>
                      </span>
                      <span className="tabular text-muted-foreground hidden text-xs sm:block">
                        {formatVnd(p.price)}
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
              onConfirm((products.data ?? []).filter((p) => picked.has(p.id)));
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
