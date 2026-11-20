'use client';

import { Check, Info, Loader2, PackageSearch, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import {
  HOME_LIVING_KIND_LABEL,
  IMAGE_ASPECTS,
  IMAGE_COUNTS,
  IMAGE_MODES,
  IMAGE_MODE_META,
  REFERENCE_KIND_LABEL,
  VISUAL_FACT_LABEL,
  type ImageProviderId,
} from '@acs/shared';
import {
  EmptyState,
  Field,
  MediaPreview,
  OptionChips,
  PromptEditor,
  SectionCard,
  StatusBadge,
} from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ProductPickerDialog } from '@/components/videos/product-picker-dialog';
import { PROVIDER_STATUS_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { assetToImageRef, hueFromString } from '@/types/domain';
import type { ImageStudioState } from './use-image-studio';

const usd = (s: string | null) => (s === null ? '—' : `$${Number(s).toFixed(4)}`);
const SOURCE_LABEL = {
  attribute: 'thuộc tính',
  name: 'tên',
  category: 'danh mục',
  user: 'người dùng',
} as const;

function ProductSection({ s }: { s: ImageStudioState }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const ctx = s.context?.visualContext;
  return (
    <SectionCard step={1} title="Sản phẩm & ảnh tham chiếu">
      {s.product ? (
        <div className="flex items-start gap-2.5 rounded-lg border p-2">
          <MediaPreview
            image={{
              id: s.product.id,
              url: s.product.primaryImage?.previewUrl ?? undefined,
              hue: hueFromString(s.product.id),
            }}
            className="size-12"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{s.product.name}</p>
            <p className="text-muted-foreground text-xs">
              {s.product.sku} · {s.product.category} · {s.product.imageCount} ảnh
            </p>
            {ctx ? (
              <p className="mt-0.5 text-xs">
                {ctx.kind ? (
                  <Badge variant="info">{HOME_LIVING_KIND_LABEL[ctx.kind]}</Badge>
                ) : (
                  <Badge variant="warning">Chưa nhận diện loại</Badge>
                )}
              </p>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setPickerOpen(true)}>
            Đổi
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <PackageSearch /> Chọn sản phẩm
        </Button>
      )}

      {s.contextError ? <p className="text-danger text-xs">{s.contextError}</p> : null}
      {s.contextLoading ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Loader2 className="size-3.5 animate-spin" /> Đang đọc dữ liệu sản phẩm…
        </p>
      ) : null}

      {ctx ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2.5">
          <p className="text-xs font-medium">Dữ kiện sẽ đưa vào prompt (chỉ từ dữ liệu sản phẩm)</p>
          {ctx.facts.length ? (
            <ul className="flex flex-col gap-0.5 text-xs">
              {ctx.facts.map((f) => (
                <li key={f.field} className="flex gap-1.5">
                  <span className="text-muted-foreground shrink-0">
                    {VISUAL_FACT_LABEL[f.field]}:
                  </span>
                  <span className="min-w-0 break-words">{f.value}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                    ({SOURCE_LABEL[f.source]})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">
              Sản phẩm chưa có thuộc tính màu, họa tiết…
            </p>
          )}
          {ctx.missing.length ? (
            <p className="text-foreground flex gap-1 text-[11px] leading-snug">
              <TriangleAlert className="text-warning mt-px size-3.5 shrink-0" aria-hidden />
              Chưa khai báo: {ctx.missing.map((f) => VISUAL_FACT_LABEL[f].toLowerCase()).join(', ')}
              . AI chỉ dựa vào ảnh – hệ thống không tự đoán. Bổ sung ở trang Sản phẩm để kết quả
              chính xác hơn.
            </p>
          ) : null}
          <p className="text-muted-foreground text-[11px]">
            Ảnh chưa được AI phân tích tự động – màu/hoa văn lấy từ thuộc tính bạn nhập.
          </p>
        </div>
      ) : null}

      {s.product && s.context ? (
        s.references.length ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              Ảnh tham chiếu ({s.refIds.length}/{s.maxRefs} tối đa)
            </span>
            {s.template ? (
              <p className="text-muted-foreground text-[11px]">
                Nên dùng: {REFERENCE_KIND_LABEL[s.template.reference.preferred]}.{' '}
                {s.template.reference.note}
              </p>
            ) : null}
            <ul className="grid grid-cols-4 gap-1.5" aria-label="Ảnh tham chiếu">
              {s.references.map((r) => {
                const checked = s.refIds.includes(r.id);
                const full = !checked && s.refIds.length >= s.maxRefs;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Dùng ảnh ${r.filename} làm tham chiếu`}
                      disabled={full}
                      onClick={() => s.toggleRef(r.id)}
                      className={cn(
                        'relative block w-full cursor-pointer overflow-hidden rounded-md border-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40',
                        checked ? 'border-primary' : 'border-transparent',
                      )}
                    >
                      <MediaPreview image={assetToImageRef(r)} className="w-full" rounded="" />
                      {checked ? (
                        <span className="bg-primary text-primary-foreground absolute top-1 left-1 grid size-4 place-items-center rounded">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <EmptyState
            icon={Info}
            className="py-4"
            title="Sản phẩm chưa có ảnh gốc"
            description="Tải ảnh sản phẩm thật ở trang Sản phẩm trước khi tạo ảnh AI."
          />
        )
      ) : null}

      <ProductPickerDialog
        key={pickerOpen ? 'open' : 'closed'}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={s.product ? [s.product] : []}
        title="Chọn 1 sản phẩm để tạo ảnh"
        onConfirm={(list) => {
          const fresh = list.filter((p) => p.id !== s.product?.id);
          s.chooseProduct(fresh.at(-1) ?? list[0] ?? null);
        }}
      />
    </SectionCard>
  );
}

function ModeSection({ s }: { s: ImageStudioState }) {
  return (
    <SectionCard step={2} title="Chế độ tạo ảnh">
      <div
        className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Chế độ tạo ảnh"
      >
        {IMAGE_MODES.map((m) => {
          const meta = IMAGE_MODE_META[m];
          const checked = s.config.mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => s.update('mode', m)}
              className={cn(
                'flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                checked ? 'border-primary bg-primary/10' : 'hover:bg-accent/60',
              )}
            >
              <span className="flex items-center gap-1.5 text-[13px] leading-tight font-medium">
                <span className="text-muted-foreground font-mono text-[11px]">{meta.letter}</span>
                {meta.label}
              </span>
              <span className="text-muted-foreground text-[11px] leading-snug">
                {meta.description}
              </span>
            </button>
          );
        })}
      </div>
      {!s.usesAi ? (
        <p className="text-muted-foreground text-xs">
          Chế độ F dùng xử lý ảnh truyền thống trên server: ảnh gốc được đặt nguyên vẹn lên nền,
          không phải ảnh do AI tạo, không tốn chi phí AI.
        </p>
      ) : null}
    </SectionCard>
  );
}

function SceneSection({ s }: { s: ImageStudioState }) {
  const matches = s.context?.templates ?? [];
  const applicable = matches.filter((m) => m.applicable);
  const hidden = matches.length - applicable.length;
  return (
    <SectionCard step={3} title="Bối cảnh & phong cách">
      {!s.product ? (
        <p className="text-muted-foreground text-xs">Chọn sản phẩm để xem bối cảnh phù hợp.</p>
      ) : applicable.length === 0 ? (
        <p className="text-muted-foreground text-xs">Không có bối cảnh phù hợp với chế độ này.</p>
      ) : (
        <div
          className="grid grid-cols-1 gap-1.5 sm:grid-cols-2"
          role="radiogroup"
          aria-label="Bối cảnh"
        >
          {applicable.map(({ template: t, recommended }) => {
            const checked = t.id === s.config.templateId;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => s.update('templateId', t.id)}
                className={cn(
                  'flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-2 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                  checked ? 'border-primary bg-primary/10' : 'hover:bg-accent/60',
                )}
              >
                <span className="flex w-full items-center gap-1 text-[13px] leading-tight font-medium">
                  <span className="text-muted-foreground font-mono text-[11px]">{t.code}</span>
                  <span className="min-w-0 flex-1">{t.name}</span>
                  {recommended ? <Badge variant="success">Gợi ý</Badge> : null}
                </span>
                <span className="text-muted-foreground text-[11px] leading-snug">
                  {t.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {hidden > 0 && s.product ? (
        <p className="text-muted-foreground text-[11px]">
          Đã ẩn {hidden} bối cảnh không hợp với loại sản phẩm/chế độ (vd thảm không đặt trong phòng
          ngủ sang trọng).
        </p>
      ) : null}

      {s.usesAi ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Phong cách ánh sáng</span>
            <OptionChips
              label="Phong cách"
              size="sm"
              value={s.config.styleId ?? ''}
              onChange={(v) => s.update('styleId', v)}
              options={(s.catalog?.styles ?? []).map((st) => ({ value: st.id, label: st.label }))}
            />
          </div>
          <PromptEditor
            label="Yêu cầu thêm (tuỳ chọn)"
            value={s.config.userPrompt}
            onChange={(v) => s.update('userPrompt', v)}
            rows={3}
            maxLength={1000}
            placeholder="VD: thêm một chậu cây nhỏ cạnh giường, ánh nắng buổi sáng… (không ghi đè quy tắc giữ đúng sản phẩm)"
          />
        </>
      ) : (
        <Field label="Màu nền" htmlFor="img-bg" hint="Mã màu #RRGGBB">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Chọn màu nền"
              value={s.config.backgroundColor}
              onChange={(e) => s.update('backgroundColor', e.target.value.toUpperCase())}
              className="size-9 cursor-pointer rounded border"
            />
            <Input
              id="img-bg"
              value={s.config.backgroundColor}
              onChange={(e) => s.update('backgroundColor', e.target.value)}
              className="max-w-32 font-mono"
            />
          </div>
        </Field>
      )}
    </SectionCard>
  );
}

function OutputSection({ s }: { s: ImageStudioState }) {
  const providers = s.providers?.providers ?? [];
  return (
    <SectionCard step={4} title="Kích thước & nhà cung cấp">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tỷ lệ ảnh</span>
        <OptionChips
          label="Tỷ lệ ảnh"
          value={s.config.aspect}
          onChange={(v) => s.update('aspect', v)}
          options={[...IMAGE_ASPECTS]
            .sort((a, b) => Number(b === '9:16') - Number(a === '9:16'))
            .map((a) => ({ value: a, label: a === '9:16' ? '9:16 (TikTok)' : a }))}
        />
      </div>
      {s.usesAi ? (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Số lượng ảnh</span>
            <OptionChips
              label="Số lượng ảnh"
              value={s.config.count}
              onChange={(v) => s.update('count', v)}
              options={IMAGE_COUNTS.map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
          <Field
            label="Nhà cung cấp AI"
            htmlFor="img-provider"
            badge={
              s.providerStatus ? (
                <StatusBadge meta={PROVIDER_STATUS_META[s.providerStatus.status]} />
              ) : null
            }
            hint={s.providerStatus?.message}
          >
            <NativeSelect
              id="img-provider"
              value={s.config.provider ?? ''}
              onChange={(e) =>
                s.update('provider', (e.target.value || null) as ImageProviderId | null)
              }
              placeholder="Chọn nhà cung cấp"
              options={providers.map((p) => ({
                value: p.id,
                label: `${p.displayName}${p.status === 'ready' ? '' : ` – ${PROVIDER_STATUS_META[p.status].label}`}`,
                disabled: p.status !== 'ready',
              }))}
            />
          </Field>
          {s.providerStatus?.models.length ? (
            <Field label="Model" htmlFor="img-model" hint={s.modelInfo?.pricingSource}>
              <NativeSelect
                id="img-model"
                value={s.config.model ?? ''}
                onChange={(e) => s.update('model', e.target.value || null)}
                options={s.providerStatus.models.map((m) => ({ value: m.id, label: m.label }))}
              />
            </Field>
          ) : null}
          {s.providerStatus?.isMock ? (
            <p className="text-foreground text-xs">
              Mock không phải AI: ảnh chỉ là ảnh gốc đặt trên nền màu kèm dải chữ MOCK, dùng để thử
              luồng.
            </p>
          ) : null}
          {providers.every((p) => p.status !== 'ready' || p.isMock) ? (
            <p className="text-muted-foreground text-xs">
              Chưa có nhà cung cấp AI thật được cấu hình. Đặt GOOGLE_API_KEY (Gemini) ở server – xem
              Cài đặt › API Providers.
            </p>
          ) : null}
        </>
      ) : null}
    </SectionCard>
  );
}

function GenerateBox({ s }: { s: ImageStudioState }) {
  const e = s.estimate;
  return (
    <div className="bg-card flex flex-col gap-2 rounded-xl border p-3.5 shadow-xs">
      {e ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-muted-foreground">Chi phí ước tính</dt>
          <dd className="font-medium">
            {e.usesAi
              ? `${usd(e.estimatedCostUsd)} (${e.count} × ${usd(e.pricePerImageUsd)})`
              : 'Không tốn chi phí AI'}
          </dd>
          {e.usesAi ? (
            <>
              <dt className="text-muted-foreground">Ngân sách ngày còn</dt>
              <dd>${Number(e.remainingDailyUsd).toFixed(2)}</dd>
              <dt className="text-muted-foreground">Nguồn đơn giá</dt>
              <dd className="text-muted-foreground">{e.pricingSource}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {e && !e.allowed ? (
        <p role="alert" className="text-danger text-xs">
          {e.reason}
        </p>
      ) : null}
      {s.estimateError ? (
        <p role="alert" className="text-danger text-xs">
          {s.estimateError}
        </p>
      ) : null}
      {e?.promptPreview ? (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium">
            Xem prompt & quy tắc giữ đúng sản phẩm
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
            {e.promptPreview.preserveRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {e.promptPreview.warnings.length ? (
            <ul className="text-foreground mt-1.5 space-y-0.5">
              {e.promptPreview.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          ) : null}
          <pre className="bg-muted mt-1.5 max-h-48 overflow-auto rounded p-2 text-[10px] whitespace-pre-wrap">
            {e.promptPreview.prompt}
          </pre>
        </details>
      ) : null}
      <Button onClick={() => void s.generate()} disabled={!s.canGenerate}>
        {s.busy === 'generate' ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {s.usesAi ? `Tạo ${s.config.count} ảnh` : 'Ghép ảnh gốc'}
      </Button>
      {s.estimateLoading ? (
        <p className="text-muted-foreground text-center text-[11px]">Đang ước tính chi phí…</p>
      ) : !s.product ? (
        <p className="text-muted-foreground text-center text-[11px]">
          Chọn sản phẩm có ảnh gốc để bắt đầu
        </p>
      ) : null}
      <p className="text-muted-foreground text-[11px]">
        AI không bảo đảm giữ chính xác mọi chi tiết sản phẩm. Hãy so sánh với ảnh gốc và duyệt trước
        khi dùng.
      </p>
    </div>
  );
}

export function ImageConfigPanel({ s }: { s: ImageStudioState }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ProductSection s={s} />
      <ModeSection s={s} />
      <SceneSection s={s} />
      <OutputSection s={s} />
      <GenerateBox s={s} />
    </div>
  );
}
