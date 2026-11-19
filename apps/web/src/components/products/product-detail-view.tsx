'use client';

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  ExternalLink,
  Maximize2,
  Pencil,
  Star,
  Trash2,
  Unlink,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { ProductDetail, ProductMediaItem } from '@acs/shared';
import {
  ConfirmDialog,
  DemoBadge,
  ErrorState,
  FileUpload,
  type LocalFile,
  LoadingState,
  MediaPreview,
  StatusBadge,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { useAsync } from '@/hooks/use-async';
import { describeError } from '@/lib/api/client';
import { mediaRepository, productRepository } from '@/lib/data';
import { formatBytes, formatDateTime, formatMoney } from '@/lib/format';
import { PRODUCT_SOURCE_LABEL, PRODUCT_STATUS_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { assetToImageRef } from '@/types/domain';
import { ProductFormDialog } from './product-form-dialog';

interface UploadRow {
  id: string;
  name: string;
  state: 'uploading' | 'done' | 'duplicate' | 'error';
  message?: string;
}

export function ProductDetailView({ id }: { id: string }) {
  const router = useRouter();
  const query = useAsync(() => productRepository.get(id), [id]);
  const [product, setProduct] = useState<ProductDetail>();
  const p = product?.id === id ? product : query.data;
  const categories = useAsync(() => productRepository.categories(), []);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDetach, setConfirmDetach] = useState<ProductMediaItem>();
  const [viewing, setViewing] = useState<ProductMediaItem>();
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [fetchingUrl, setFetchingUrl] = useState<string>();

  if (query.error && !p) return <ErrorState message={query.error} onRetry={query.reload} />;
  if (!p) return <LoadingState variant="block" />;

  const media = p.media;
  const primary = media.find((m) => m.isPrimary) ?? media[0];

  const act = async (label: string, fn: () => Promise<ProductDetail>) => {
    setBusy(true);
    try {
      setProduct(await fn());
    } catch (error) {
      toast.error(`${label} thất bại`, { description: describeError(error) });
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, delta: number) => {
    const ids = media.map((m) => m.mediaAssetId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void act('Sắp xếp ảnh', () => productRepository.reorderMedia(p.id, ids));
  };

  const uploadFiles = async (files: LocalFile[]) => {
    const rows: UploadRow[] = files.map((f) => ({
      id: f.id,
      name: f.file.name,
      state: 'uploading',
    }));
    setUploads((prev) => [...rows, ...prev].slice(0, 20));
    const assetIds: string[] = [];
    for (const f of files) {
      try {
        const res = await mediaRepository.upload(f.file);
        assetIds.push(res.asset.id);
        setUploads((prev) =>
          prev.map((r) =>
            r.id === f.id
              ? {
                  ...r,
                  state: res.duplicate ? 'duplicate' : 'done',
                  message: res.duplicate ? 'Trùng nội dung – dùng lại ảnh đã có' : undefined,
                }
              : r,
          ),
        );
      } catch (error) {
        setUploads((prev) =>
          prev.map((r) =>
            r.id === f.id ? { ...r, state: 'error', message: describeError(error) } : r,
          ),
        );
      } finally {
        URL.revokeObjectURL(f.previewUrl);
      }
    }
    if (assetIds.length) {
      await act('Gắn ảnh vào sản phẩm', () => productRepository.attachMedia(p.id, assetIds));
      toast.success(`Đã tải lên và gắn ${assetIds.length} ảnh`);
    }
  };

  const fetchFromUrl = async (url: string) => {
    setFetchingUrl(url);
    try {
      setProduct(await productRepository.importFromUrl(p.id, url));
      toast.success('Đã tải ảnh từ URL');
    } catch (error) {
      toast.error('Không tải được ảnh từ URL', { description: describeError(error) });
    } finally {
      setFetchingUrl(undefined);
    }
  };

  const margin =
    p.costPrice && Number(p.sellingPrice) > 0
      ? Math.round(((Number(p.sellingPrice) - Number(p.costPrice)) / Number(p.sellingPrice)) * 100)
      : null;

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <Link
            href="/products"
            className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" /> Danh sách sản phẩm
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{p.name}</h1>
            <StatusBadge meta={PRODUCT_STATUS_META[p.status]} />
            {p.sourceType === 'seed' ? <DemoBadge label="MẪU" /> : null}
          </div>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{p.sku}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Chỉnh sửa
          </Button>
          <Button variant="outline" className="text-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 /> Xoá
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <section
          aria-label="Hình ảnh sản phẩm"
          className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Hình ảnh ({media.length})</h2>
            {busy ? <span className="text-muted-foreground text-xs">Đang cập nhật…</span> : null}
          </div>
          {primary ? (
            <button
              type="button"
              onClick={() => setViewing(primary)}
              className="group bg-checker relative mx-auto block w-full max-w-md cursor-zoom-in overflow-hidden rounded-xl border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              aria-label="Xem ảnh đại diện cỡ lớn"
            >
              <MediaPreview
                image={assetToImageRef(primary.asset)}
                className="w-full"
                rounded=""
                alt={`Ảnh đại diện ${p.name}`}
              />
              <span className="bg-sidebar text-sidebar-primary absolute top-2 left-2 rounded px-1.5 py-0.5 text-[11px] font-semibold">
                Ảnh đại diện
              </span>
            </button>
          ) : (
            <div className="bg-muted text-muted-foreground grid aspect-[4/3] place-items-center rounded-xl border border-dashed text-sm">
              Chưa có ảnh – tải ảnh lên bên dưới
            </div>
          )}

          {media.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Bộ sưu tập ảnh">
              {media.map((m, i) => (
                <li
                  key={m.mediaAssetId}
                  className={cn(
                    'group relative rounded-lg border-2',
                    m.isPrimary ? 'border-primary' : 'border-transparent',
                  )}
                >
                  <MediaPreview
                    image={assetToImageRef(m.asset)}
                    className="w-full"
                    alt={m.asset.filename}
                  />
                  <div className="bg-card/95 flex items-center justify-between gap-0.5 rounded-b-md border-t p-0.5">
                    <Tooltip content="Sang trái">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Đưa ${m.asset.filename} sang trái`}
                        disabled={busy || i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ChevronLeft />
                      </Button>
                    </Tooltip>
                    <Tooltip
                      content={m.isPrimary ? 'Đang là ảnh đại diện' : 'Đặt làm ảnh đại diện'}
                    >
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={
                          m.isPrimary
                            ? `${m.asset.filename} là ảnh đại diện`
                            : `Đặt ${m.asset.filename} làm ảnh đại diện`
                        }
                        aria-pressed={m.isPrimary}
                        disabled={busy || m.isPrimary}
                        onClick={() =>
                          void act('Đổi ảnh đại diện', () =>
                            productRepository.setPrimary(p.id, m.mediaAssetId),
                          )
                        }
                      >
                        <Star className={cn(m.isPrimary && 'fill-primary text-primary')} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Xem lớn">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Xem lớn ${m.asset.filename}`}
                        onClick={() => setViewing(m)}
                      >
                        <Maximize2 />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Gỡ khỏi sản phẩm">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Gỡ ${m.asset.filename} khỏi sản phẩm`}
                        disabled={busy}
                        onClick={() => setConfirmDetach(m)}
                      >
                        <Unlink />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Sang phải">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Đưa ${m.asset.filename} sang phải`}
                        disabled={busy || i === media.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ChevronRight />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          <FileUpload
            onFiles={(files) => void uploadFiles(files)}
            label="Tải ảnh lên (kéo thả hoặc bấm để chọn)"
            hint="JPG, PNG, WebP · tối đa 10 MB/ảnh · lưu vào MinIO và gắn vào sản phẩm"
          />
          {uploads.length ? (
            <ul
              className="flex flex-col gap-1.5"
              aria-label="Tiến trình tải ảnh"
              aria-live="polite"
            >
              {uploads.map((u) => (
                <li key={u.id} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{u.name}</span>
                    <span
                      className={cn(
                        'shrink-0 font-medium',
                        u.state === 'error'
                          ? 'text-danger'
                          : u.state === 'uploading'
                            ? 'text-muted-foreground'
                            : 'text-success',
                      )}
                    >
                      {u.state === 'uploading'
                        ? 'Đang tải…'
                        : u.state === 'error'
                          ? 'Lỗi'
                          : u.state === 'duplicate'
                            ? 'Đã có sẵn'
                            : 'Xong'}
                    </span>
                  </div>
                  {u.state === 'uploading' ? (
                    <Progress value={60} className="animate-shimmer" label={`Đang tải ${u.name}`} />
                  ) : null}
                  {u.message ? (
                    <span className={u.state === 'error' ? 'text-danger' : 'text-muted-foreground'}>
                      {u.message}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {p.pendingImageUrls.length ? (
            <div className="border-info/30 bg-info/5 flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">
                URL ảnh từ file import ({p.pendingImageUrls.length}) – chưa tải về
              </p>
              <p className="text-muted-foreground text-xs">
                Chỉ tải được từ tên miền quản trị viên đã cho phép (IMPORT_IMAGE_ALLOWED_HOSTS) và
                bạn có quyền sử dụng ảnh.
              </p>
              <ul className="flex flex-col gap-1.5">
                {p.pendingImageUrls.map((url) => (
                  <li key={url} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-mono" title={url}>
                      {url}
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      disabled={Boolean(fetchingUrl)}
                      onClick={() => void fetchFromUrl(url)}
                    >
                      <CloudDownload /> {fetchingUrl === url ? 'Đang tải…' : 'Tải về'}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section
          aria-label="Thông tin sản phẩm"
          className="bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-xs"
        >
          <h2 className="font-semibold">Thông tin</h2>
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Giá bán</dt>
            <dd className="tabular text-base font-semibold">
              {formatMoney(p.sellingPrice, p.currency)}
            </dd>
            <dt className="text-muted-foreground">Giá vốn</dt>
            <dd className="tabular">
              {formatMoney(p.costPrice, p.currency)}
              {margin !== null ? (
                <span className="text-muted-foreground"> · biên lợi nhuận {margin}%</span>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Danh mục</dt>
            <dd>{p.category}</dd>
            <dt className="text-muted-foreground">Thương hiệu</dt>
            <dd>{p.brand ?? '—'}</dd>
            <dt className="text-muted-foreground">Nguồn</dt>
            <dd className="min-w-0">
              {PRODUCT_SOURCE_LABEL[p.sourceType]}
              {p.sourceUrl ? (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-info mt-0.5 flex max-w-full items-center gap-1 truncate hover:underline"
                >
                  <span className="truncate">{p.sourceUrl}</span>
                  <ExternalLink className="size-3.5 shrink-0" />
                </a>
              ) : null}
            </dd>
            <dt className="text-muted-foreground">Ngày tạo</dt>
            <dd className="tabular">{formatDateTime(p.createdAt)}</dd>
            <dt className="text-muted-foreground">Cập nhật</dt>
            <dd className="tabular">{formatDateTime(p.updatedAt)}</dd>
          </dl>
          <div>
            <h3 className="mb-1.5 text-sm font-medium">Thông số</h3>
            {Object.keys(p.attributes).length ? (
              <table className="w-full overflow-hidden rounded-lg border text-sm">
                <tbody>
                  {Object.entries(p.attributes).map(([k, v]) => (
                    <tr key={k} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="bg-muted/50 w-40 px-3 py-1.5 text-left font-medium"
                      >
                        {k}
                      </th>
                      <td className="px-3 py-1.5">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-sm">Chưa có thông số.</p>
            )}
          </div>
          <div>
            <h3 className="mb-1.5 text-sm font-medium">Mô tả</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line">{p.description || '—'}</p>
          </div>
        </section>
      </div>

      {editing ? (
        <ProductFormDialog
          open={editing}
          onOpenChange={setEditing}
          product={p}
          categories={categories.data ?? []}
          onSaved={(saved) => {
            setProduct(saved);
            toast.success('Đã lưu thay đổi');
          }}
        />
      ) : null}

      <Dialog open={Boolean(viewing)} onOpenChange={(o) => !o && setViewing(undefined)}>
        <DialogContent size="xl">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle className="break-all">{viewing.asset.filename}</DialogTitle>
                <DialogDescription>
                  {viewing.asset.width}×{viewing.asset.height}px ·{' '}
                  {formatBytes(viewing.asset.fileSize)} · {viewing.asset.mimeType}
                </DialogDescription>
              </DialogHeader>
              <MediaPreview
                image={assetToImageRef(viewing.asset)}
                aspect="auto"
                className="bg-checker mx-auto max-h-[70vh] w-auto rounded-lg border"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirmDetach)}
        onOpenChange={(o) => !o && setConfirmDetach(undefined)}
        title="Gỡ ảnh khỏi sản phẩm?"
        description="Ảnh vẫn được giữ trong Thư viện, chỉ bỏ liên kết với sản phẩm này."
        confirmLabel="Gỡ ảnh"
        onConfirm={() => {
          const m = confirmDetach!;
          void act('Gỡ ảnh', () => productRepository.detachMedia(p.id, m.mediaAssetId));
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title={`Xoá sản phẩm "${p.name}"?`}
        description="Sản phẩm bị xoá vĩnh viễn khỏi database. Ảnh trong thư viện vẫn được giữ lại."
        confirmLabel="Xoá vĩnh viễn"
        onConfirm={() => {
          void (async () => {
            try {
              await productRepository.remove(p.id);
              toast.success(`Đã xoá "${p.name}"`);
              router.push('/products');
            } catch (error) {
              toast.error('Xoá thất bại', { description: describeError(error) });
            }
          })();
        }}
      />
    </>
  );
}
