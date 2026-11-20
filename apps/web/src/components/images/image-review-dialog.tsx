'use client';

import {
  Check,
  Download,
  FolderPlus,
  Link2,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
  ZoomIn,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
  IMAGE_REVIEW_FLAGS,
  IMAGE_REVIEW_FLAG_LABEL,
  type ImageItem,
  type ImageJobDetail,
  type ImageReviewFlag,
} from '@acs/shared';
import { DemoBadge, OptionChips, StatusBadge } from '@/components/common';
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
import { Textarea } from '@/components/ui/textarea';
import { IMAGE_APPROVAL_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import type { ImageStudioState } from './use-image-studio';

const ZOOMS = [1, 2, 4] as const;

/** Hai khung cuộn đồng bộ: ảnh gốc | ảnh mới, cùng mức zoom để soi hoa văn/đường may. */
function ComparePanes({
  left,
  right,
  zoom,
}: {
  left: { url: string | null; label: string };
  right: { url: string | null; label: string };
  zoom: number;
}) {
  const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)] as const;
  const syncing = useRef(false);
  const onScroll = (from: 0 | 1) => {
    if (syncing.current) return;
    const a = refs[from].current;
    const b = refs[from === 0 ? 1 : 0].current;
    if (!a || !b) return;
    syncing.current = true;
    const rx = a.scrollLeft / Math.max(1, a.scrollWidth - a.clientWidth);
    const ry = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    b.scrollLeft = rx * (b.scrollWidth - b.clientWidth);
    b.scrollTop = ry * (b.scrollHeight - b.clientHeight);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {[left, right].map((pane, i) => (
        <figure key={pane.label} className="flex min-w-0 flex-col gap-1">
          <figcaption className="text-xs font-medium">{pane.label}</figcaption>
          <div
            ref={refs[i]}
            onScroll={() => onScroll(i as 0 | 1)}
            className="bg-checker h-[52dvh] overflow-auto rounded-lg border"
          >
            {pane.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL presigned từ MinIO
              <img
                src={pane.url}
                alt={pane.label}
                style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
                className={cn(zoom === 1 && 'h-full w-full object-contain')}
              />
            ) : (
              <div className="text-muted-foreground grid h-full place-items-center p-4 text-center text-xs">
                Không có ảnh
              </div>
            )}
          </div>
        </figure>
      ))}
    </div>
  );
}

function ReviewBody({
  s,
  job,
  item,
}: {
  s: ImageStudioState;
  job: ImageJobDetail;
  item: ImageItem;
}) {
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [refIndex, setRefIndex] = useState(0);
  const [flags, setFlags] = useState<ImageReviewFlag[]>(item.reviewFlags);
  const [note, setNote] = useState(item.reviewNote ?? '');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const ref = job.references[refIndex] ?? job.references[0];
  const auto = item.autoCheck;
  const busy = s.busy?.endsWith(item.id) ?? false;
  const done = item.status === 'COMPLETED' && !!item.asset;
  const toggleFlag = (f: ImageReviewFlag) =>
    setFlags((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  const coverage = auto?.colorCoverage;

  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <DialogTitle>
            Ảnh {item.index + 1} · {job.templateName}
          </DialogTitle>
          <StatusBadge meta={IMAGE_APPROVAL_META[item.approvalStatus]} />
          {job.isMock ? <DemoBadge label="MOCK – KHÔNG PHẢI ẢNH AI" /> : null}
          {!job.usesAi ? <DemoBadge label="ẢNH GHÉP – KHÔNG PHẢI AI" /> : null}
        </div>
        <DialogDescription>
          So sánh kỹ màu sắc, họa tiết, đường may, hình dáng và số lượng thành phần với ảnh gốc
          trước khi duyệt. AI không bảo đảm giữ chính xác mọi chi tiết.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ZoomIn className="text-muted-foreground size-4" aria-hidden />
          <OptionChips
            label="Mức zoom"
            size="sm"
            value={zoom}
            onChange={setZoom}
            options={ZOOMS.map((z) => ({ value: z, label: `${z}×` }))}
          />
          {job.references.length > 1 ? (
            <OptionChips
              label="Ảnh gốc để so sánh"
              size="sm"
              value={refIndex}
              onChange={setRefIndex}
              options={job.references.map((_, i) => ({ value: i, label: `Gốc ${i + 1}` }))}
            />
          ) : null}
        </div>
        <ComparePanes
          zoom={zoom}
          left={{ url: ref?.previewUrl ?? null, label: 'Ảnh gốc (bất biến)' }}
          right={{ url: item.asset?.previewUrl ?? null, label: job.usesAi ? 'Ảnh AI' : 'Ảnh ghép' }}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <section className="flex flex-col gap-1.5 rounded-lg border p-2.5">
            <h3 className="text-sm font-medium">Danh sách tự kiểm</h3>
            <p className="text-muted-foreground text-[11px]">
              Giúp bạn soát từng điểm – không lưu lại.
            </p>
            <ul className="flex flex-col gap-1">
              {item.preserveRules.map((rule, i) => (
                <li key={rule}>
                  <label className="flex cursor-pointer items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked.has(i)}
                      onChange={() =>
                        setChecked((cur) => {
                          const next = new Set(cur);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                    />
                    {rule}
                  </label>
                </li>
              ))}
            </ul>
            {item.warnings.length ? (
              <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
                {item.warnings.map((w) => (
                  <li key={w} className="flex gap-1">
                    <TriangleAlert className="text-warning mt-px size-3.5 shrink-0" aria-hidden />{' '}
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="flex flex-col gap-1.5 rounded-lg border p-2.5">
            <h3 className="text-sm font-medium">Kiểm tra tự động (tham khảo)</h3>
            {auto ? (
              <>
                <p className="text-xs">
                  Màu chủ đạo của ảnh gốc xuất hiện trong ảnh mới:{' '}
                  <strong
                    className={cn(
                      coverage !== null &&
                        coverage !== undefined &&
                        coverage < 0.6 &&
                        'text-danger',
                    )}
                  >
                    {coverage === null || coverage === undefined
                      ? 'không tính được'
                      : `${Math.round(coverage * 100)}%`}
                  </strong>
                </p>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  {[
                    { label: 'Gốc', colors: auto.referencePalette },
                    { label: 'Mới', colors: auto.outputPalette },
                  ].map((p) => (
                    <span key={p.label} className="flex items-center gap-1">
                      {p.label}:
                      {p.colors.map((c) => (
                        <span
                          key={c}
                          title={c}
                          className="inline-block size-4 rounded border"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </span>
                  ))}
                </div>
                {auto.notes.map((n) => (
                  <p key={n} className="text-xs">
                    {n}
                  </p>
                ))}
                <p className="text-muted-foreground text-[11px]">{auto.method}</p>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">Chưa có kết quả kiểm tra.</p>
            )}
          </section>
        </div>

        {done ? (
          <section className="flex flex-col gap-1.5 rounded-lg border p-2.5">
            <h3 className="text-sm font-medium">Gắn cờ nếu ảnh có nguy cơ sai sản phẩm</h3>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cờ duyệt ảnh">
              {IMAGE_REVIEW_FLAGS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={flags.includes(f)}
                  onClick={() => toggleFlag(f)}
                  className={cn(
                    'cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    flags.includes(f)
                      ? 'border-danger bg-danger/10 text-danger'
                      : 'hover:bg-accent/60',
                  )}
                >
                  {IMAGE_REVIEW_FLAG_LABEL[f]}
                </button>
              ))}
            </div>
            <Textarea
              aria-label="Ghi chú duyệt"
              value={note}
              maxLength={500}
              rows={2}
              placeholder="Ghi chú (tuỳ chọn)…"
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => void s.approve(item.id, { note: note || null, flags })}
              >
                <Check /> Duyệt ảnh
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void s.reject(item.id, { note: note || null, flags })}
              >
                <X /> Từ chối
              </Button>
            </div>
          </section>
        ) : null}
      </DialogBody>
      <DialogFooter className="flex-wrap">
        <Button variant="outline" disabled={!done} onClick={() => void s.download(item.id)}>
          <Download /> Tải xuống
        </Button>
        <Button
          variant="outline"
          disabled={!done || item.savedToLibrary || item.approvalStatus === 'rejected' || busy}
          onClick={() => void s.save(item.id)}
        >
          <FolderPlus /> {item.savedToLibrary ? 'Đã lưu thư viện' : 'Lưu vào thư viện'}
        </Button>
        <Button
          variant="outline"
          disabled={item.approvalStatus !== 'approved' || item.linkedToProduct || busy}
          title={item.approvalStatus !== 'approved' ? 'Cần duyệt ảnh trước' : undefined}
          onClick={() => void s.link(item.id)}
        >
          <Link2 /> {item.linkedToProduct ? 'Đã gắn sản phẩm' : 'Gắn vào sản phẩm'}
        </Button>
        <Button
          variant="outline"
          disabled={busy || ['QUEUED', 'RUNNING', 'WAITING_PROVIDER'].includes(item.status)}
          onClick={() => void s.regenerate(item.id)}
        >
          {s.busy === `regen:${item.id}` ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tạo
          lại
        </Button>
      </DialogFooter>
    </>
  );
}

export function ImageReviewDialog({
  s,
  itemId,
  onOpenChange,
}: {
  s: ImageStudioState;
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const item = s.job?.items.find((i) => i.id === itemId) ?? null;
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        {item && s.job ? <ReviewBody key={item.id} s={s} job={s.job} item={item} /> : null}
      </DialogContent>
    </Dialog>
  );
}
