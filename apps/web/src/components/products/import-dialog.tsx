'use client';

import { CircleAlert, CircleCheck, Download, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  IMPORT_FIELDS,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MODES,
  IMPORT_MODE_DESCRIPTION,
  IMPORT_MODE_LABEL,
  type ImportMapping,
  type ImportMode,
  type ImportPreview,
  type ImportResult,
  type ImportRowAction,
} from '@acs/shared';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
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
import { NativeSelect } from '@/components/ui/native-select';
import { describeError } from '@/lib/api/client';
import { importRepository } from '@/lib/data';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

type Step = 'pick' | 'map' | 'result';

const ACTION_META: Record<ImportRowAction, { label: string; variant: BadgeVariant }> = {
  create: { label: 'Tạo mới', variant: 'success' },
  update: { label: 'Cập nhật', variant: 'info' },
  skip: { label: 'Bỏ qua', variant: 'neutral' },
  error: { label: 'Lỗi', variant: 'danger' },
};

function Summary({ result }: { result: ImportResult }) {
  const s = result.summary;
  const items = [
    { label: result.committed ? 'Đã tạo' : 'Sẽ tạo', value: s.created, tone: 'text-success' },
    {
      label: result.committed ? 'Đã cập nhật' : 'Sẽ cập nhật',
      value: s.updated,
      tone: 'text-info',
    },
    { label: 'Bỏ qua', value: s.skipped, tone: 'text-neutral' },
    { label: 'Lỗi', value: s.failed, tone: 'text-danger' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-muted/60 rounded-lg p-2.5 text-center">
          <p className="text-muted-foreground text-xs">{i.label}</p>
          <p className={cn('tabular text-xl font-bold', i.tone)}>{formatNumber(i.value)}</p>
        </div>
      ))}
    </div>
  );
}

function RowResults({ result, onlyIssues }: { result: ImportResult; onlyIssues: boolean }) {
  const rows = result.rows.filter(
    (r) => !onlyIssues || r.action === 'error' || r.action === 'skip',
  );
  const shown = rows.slice(0, 300);
  return (
    <div className="scrollbar-thin max-h-72 overflow-auto rounded-lg border">
      <table className="w-full text-sm" aria-label="Kết quả từng dòng">
        <thead className="bg-muted/70 sticky top-0">
          <tr className="text-muted-foreground text-left text-xs">
            <th className="px-2.5 py-2">Dòng</th>
            <th className="px-2.5 py-2">SKU</th>
            <th className="px-2.5 py-2">Tên</th>
            <th className="px-2.5 py-2">Kết quả</th>
            <th className="px-2.5 py-2">Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.rowNumber} className="border-t align-top">
              <td className="tabular px-2.5 py-1.5">{r.rowNumber}</td>
              <td className="px-2.5 py-1.5 font-mono text-xs">{r.sku ?? '—'}</td>
              <td className="max-w-48 truncate px-2.5 py-1.5">{r.name ?? '—'}</td>
              <td className="px-2.5 py-1.5">
                <Badge variant={ACTION_META[r.action].variant}>{ACTION_META[r.action].label}</Badge>
              </td>
              <td className="text-muted-foreground px-2.5 py-1.5 text-xs">
                {r.errors.join(' · ') || (r.imageUrlCount ? `${r.imageUrlCount} URL ảnh` : '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? (
        <p className="text-muted-foreground border-t p-2 text-xs">
          … và {rows.length - shown.length} dòng nữa
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-muted-foreground p-3 text-sm">Không có dòng nào cần chú ý.</p>
      ) : null}
    </div>
  );
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>('pick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [mode, setMode] = useState<ImportMode>('skip_duplicates');
  const [check, setCheck] = useState<ImportResult>();
  const [final, setFinal] = useState<ImportResult>();
  const [onlyIssues, setOnlyIssues] = useState(false);

  const reset = () => {
    setStep('pick');
    setPreview(undefined);
    setCheck(undefined);
    setFinal(undefined);
    setError(undefined);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);
    if (!/\.(xlsx|csv)$/i.test(file.name)) return setError('Chỉ hỗ trợ file .xlsx hoặc .csv');
    if (file.size > IMPORT_MAX_FILE_BYTES)
      return setError(`File vượt quá ${IMPORT_MAX_FILE_BYTES / 1024 / 1024} MB`);
    setBusy(true);
    try {
      const p = await importRepository.preview(file);
      setPreview(p);
      setMapping(p.suggestedMapping);
      setCheck(undefined);
      setStep('map');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const request = () => ({
    format: preview!.format,
    headers: preview!.headers,
    rows: preview!.rows,
    mapping,
    mode,
  });

  const runValidate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setCheck(await importRepository.validate(request()));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const runCommit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await importRepository.commit(request());
      setFinal(result);
      setStep('result');
      if (result.committed) {
        toast.success(
          `Đã import: ${result.summary.created} tạo mới, ${result.summary.updated} cập nhật`,
        );
        onImported();
      }
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const missingRequired = IMPORT_FIELDS.filter(
    (f) => f.required && (mapping[f.key] ?? null) === null,
  );
  const mappedFields = IMPORT_FIELDS.filter((f) => (mapping[f.key] ?? null) !== null);
  const writable = check ? check.summary.created + check.summary.updated : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>Import sản phẩm từ Excel/CSV</DialogTitle>
          <DialogDescription>
            {step === 'pick' &&
              'Bước 1/3 · Chọn file .xlsx hoặc .csv (UTF-8), tối đa 5 MB và 5.000 dòng.'}
            {step === 'map' &&
              `Bước 2/3 · Chọn cột tương ứng và kiểm tra dữ liệu – ${preview?.fileName} (${formatNumber(preview?.totalRows ?? 0)} dòng).`}
            {step === 'result' && 'Bước 3/3 · Kết quả import.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {error ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/8 text-danger flex gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}

          {step === 'pick' ? (
            <>
              <label
                className="border-input hover:border-primary/60 hover:bg-primary/5 focus-within:ring-ring/40 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center focus-within:ring-[3px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void pickFile(e.dataTransfer.files[0]);
                }}
              >
                <UploadCloud className="text-muted-foreground size-8" aria-hidden />
                <span className="font-medium">
                  {busy ? 'Đang đọc file…' : 'Kéo thả file hoặc bấm để chọn'}
                </span>
                <span className="text-muted-foreground text-xs">.xlsx hoặc .csv · tối đa 5 MB</span>
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  aria-label="Chọn file import"
                  disabled={busy}
                  onChange={(e) => {
                    void pickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <FileSpreadsheet className="text-muted-foreground size-4" aria-hidden />
                <span className="text-muted-foreground">Chưa có file? Tải file mẫu:</span>
                <Button size="xs" variant="outline" asChild>
                  <a href={importRepository.templateUrl('xlsx')} download>
                    <Download /> Mẫu .xlsx
                  </a>
                </Button>
                <Button size="xs" variant="outline" asChild>
                  <a href={importRepository.templateUrl('csv')} download>
                    <Download /> Mẫu .csv
                  </a>
                </Button>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Cột ảnh (URL hình ảnh) chỉ được <strong>ghi nhận</strong>, hệ thống không tự tải ảnh
                từ nguồn chưa được phép. Ảnh có thể tải sau ở trang chi tiết sản phẩm nếu quản trị
                viên đã cấu hình nguồn được phép.
              </p>
            </>
          ) : null}

          {step === 'map' && preview ? (
            <>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Ghép cột dữ liệu</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {IMPORT_FIELDS.map((f) => (
                    <label key={f.key} className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">
                        {f.label}
                        {f.required ? <span className="text-danger"> *</span> : null}
                      </span>
                      <NativeSelect
                        aria-label={`Cột cho ${f.label}`}
                        value={
                          mapping[f.key] === null || mapping[f.key] === undefined
                            ? ''
                            : String(mapping[f.key])
                        }
                        onChange={(e) => {
                          setMapping((m) => ({
                            ...m,
                            [f.key]: e.target.value === '' ? null : Number(e.target.value),
                          }));
                          setCheck(undefined);
                        }}
                        options={[
                          { value: '', label: '— Không dùng —' },
                          ...preview.headers.map((h, i) => ({
                            value: String(i),
                            label: h || `Cột ${i + 1}`,
                          })),
                        ]}
                      />
                    </label>
                  ))}
                </div>
                {missingRequired.length ? (
                  <p className="text-danger text-xs">
                    Cần chọn cột cho: {missingRequired.map((f) => f.label).join(', ')}
                  </p>
                ) : null}
              </section>

              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold">Khi SKU đã tồn tại</legend>
                <div className="grid gap-2 md:grid-cols-3">
                  {IMPORT_MODES.map((m) => (
                    <label
                      key={m}
                      className={cn(
                        'flex cursor-pointer gap-2 rounded-lg border p-2.5 text-sm',
                        mode === m ? 'border-primary bg-primary/8' : 'hover:bg-accent/60',
                      )}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        className="mt-0.5 accent-[var(--primary)]"
                        checked={mode === m}
                        onChange={() => {
                          setMode(m);
                          setCheck(undefined);
                        }}
                      />
                      <span>
                        <span className="block font-medium">{IMPORT_MODE_LABEL[m]}</span>
                        <span className="text-muted-foreground text-xs">
                          {IMPORT_MODE_DESCRIPTION[m]}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {check ? (
                <section className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">Kết quả kiểm tra (chưa ghi dữ liệu)</h3>
                    <label className="ml-auto flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={onlyIssues}
                        onChange={(e) => setOnlyIssues(e.target.checked)}
                      />
                      Chỉ hiện dòng lỗi/bỏ qua
                    </label>
                  </div>
                  {check.abortedReason ? (
                    <p className="text-danger text-sm">{check.abortedReason}</p>
                  ) : null}
                  <Summary result={check} />
                  <RowResults result={check} onlyIssues={onlyIssues} />
                </section>
              ) : (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Xem trước {Math.min(8, preview.rows.length)} dòng đầu
                  </h3>
                  <div className="scrollbar-thin overflow-auto rounded-lg border">
                    <table className="w-full text-xs" aria-label="Xem trước dữ liệu">
                      <thead className="bg-muted/70">
                        <tr>
                          {mappedFields.map((f) => (
                            <th key={f.key} className="px-2.5 py-2 text-left whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.slice(0, 8).map((row, i) => (
                          <tr key={i} className="border-t">
                            {mappedFields.map((f) => (
                              <td key={f.key} className="max-w-48 truncate px-2.5 py-1.5">
                                {row[mapping[f.key]!] ?? ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          ) : null}

          {step === 'result' && final ? (
            <section className="flex flex-col gap-3">
              {final.committed ? (
                <p className="text-success flex items-center gap-2 font-medium">
                  <CircleCheck className="size-5" /> Đã lưu vào database.
                </p>
              ) : (
                <p className="text-danger flex items-center gap-2 font-medium">
                  <CircleAlert className="size-5" /> Không có dữ liệu nào được ghi.{' '}
                  {final.abortedReason}
                </p>
              )}
              <Summary result={final} />
              {final.summary.imageUrls ? (
                <p className="bg-info/8 text-info rounded-lg px-3 py-2 text-sm">
                  Đã ghi nhận {final.summary.imageUrls} URL ảnh nhưng <strong>chưa tải về</strong>.
                  Mở chi tiết từng sản phẩm để tải ảnh từ nguồn đã được phép.
                </p>
              ) : null}
              <RowResults result={final} onlyIssues />
            </section>
          ) : null}
        </DialogBody>

        <DialogFooter>
          {step === 'map' ? (
            <>
              <Button variant="ghost" className="mr-auto" onClick={reset} disabled={busy}>
                Chọn file khác
              </Button>
              <Button
                variant="outline"
                onClick={runValidate}
                disabled={busy || missingRequired.length > 0}
              >
                {busy && !check ? 'Đang kiểm tra…' : 'Kiểm tra dữ liệu'}
              </Button>
              <Button
                onClick={runCommit}
                disabled={busy || !check || writable === 0 || Boolean(check.abortedReason)}
              >
                {busy && check ? 'Đang nhập…' : `Nhập ${formatNumber(writable)} dòng hợp lệ`}
              </Button>
            </>
          ) : (
            <Button
              variant={step === 'result' ? 'default' : 'outline'}
              onClick={() => {
                onOpenChange(false);
                reset();
              }}
              disabled={busy}
            >
              Đóng
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
