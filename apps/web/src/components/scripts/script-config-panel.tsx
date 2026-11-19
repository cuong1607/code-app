'use client';

import { FilePlus2, Loader2, PackageSearch, Save, Sparkles, Star, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CTA_STYLES,
  HOOK_STYLES,
  SCRIPT_AUDIENCES,
  SCRIPT_DURATIONS,
  SCRIPT_TONES,
  type ScriptProviderId,
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
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ProductPickerDialog } from '@/components/videos/product-picker-dialog';
import { useAsync } from '@/hooks/use-async';
import { describeError } from '@/lib/api/client';
import { promptPresetRepository } from '@/lib/data';
import { PROVIDER_STATUS_META } from '@/lib/labels';
import { hueFromString } from '@/types/domain';
import type { ScriptStudioState } from './use-script-studio';

const usd = (s: string) => `$${Number(s).toFixed(4)}`;

function ProductCard({
  product,
  role,
  onRemove,
  onMakeMain,
}: {
  product: ScriptStudioState['products'][number];
  role: 'main' | 'compare' | 'batch';
  onRemove: () => void;
  onMakeMain?: () => void;
}) {
  const attrs = Object.entries(product.attributes).slice(0, 3);
  return (
    <li className="flex items-start gap-2.5 rounded-lg border p-2">
      <MediaPreview
        image={{
          id: product.id,
          url: product.primaryImage?.previewUrl ?? undefined,
          hue: hueFromString(product.id),
        }}
        className="size-12"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-medium">{product.name}</p>
          {role === 'main' ? (
            <Badge variant="info">Chính</Badge>
          ) : role === 'compare' ? (
            <Badge variant="neutral">So sánh</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {product.sku} · {product.category} · {product.imageCount} ảnh
        </p>
        {attrs.length ? (
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            {attrs.map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <Button size="icon-xs" variant="ghost" aria-label={`Bỏ ${product.name}`} onClick={onRemove}>
          <X />
        </Button>
        {onMakeMain ? (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={`Đặt ${product.name} làm sản phẩm chính`}
            title="Đặt làm sản phẩm chính"
            onClick={onMakeMain}
          >
            <Star />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function ScriptConfigPanel({ s }: { s: ScriptStudioState }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const presets = useAsync(() => promptPresetRepository.list('script'), []);
  const { config, update } = s;
  const isCompare = s.template?.requires.includes('compareProducts') ?? false;
  const needsCustom = s.template?.requires.includes('customInstructions') ?? false;
  const providers = s.providers.data?.providers ?? [];
  const est = s.estimate.data;
  const generating = s.generation.status === 'generating';

  const blockers: string[] = [];
  if (!s.products.length) blockers.push('Chọn sản phẩm');
  if (!config.provider || !s.ready) blockers.push('Chưa có AI provider được cấu hình');
  if (isCompare && s.products.length < 2) blockers.push('Template so sánh cần thêm 1 sản phẩm');
  if (needsCustom && !config.customInstructions.trim()) blockers.push('Nhập yêu cầu tuỳ chỉnh');
  if (est && !est.allowed) blockers.push(est.reason ?? 'Vượt ngân sách');

  const savePreset = async () => {
    const name = window.prompt('Tên prompt cần lưu');
    if (!name?.trim()) return;
    try {
      await promptPresetRepository.create({
        scope: 'script',
        name: name.trim(),
        content: config.customInstructions.trim(),
      });
      presets.reload();
      toast.success('Đã lưu prompt vào database');
    } catch (error) {
      toast.error('Không lưu được prompt', { description: describeError(error) });
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SectionCard step={1} title="Sản phẩm">
        {s.products.length ? (
          <ul className="flex flex-col gap-1.5" aria-label="Sản phẩm đã chọn">
            {s.products.map((p, i) => (
              <ProductCard
                key={p.id}
                product={p}
                role={i === 0 ? 'main' : isCompare && i <= 2 ? 'compare' : 'batch'}
                onRemove={() => s.setProducts(s.products.filter((x) => x.id !== p.id))}
                onMakeMain={
                  i > 0
                    ? () => s.setProducts([p, ...s.products.filter((x) => x.id !== p.id)])
                    : undefined
                }
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={PackageSearch}
            className="py-4"
            title="Chưa chọn sản phẩm"
            description="Kịch bản chỉ dùng dữ kiện của sản phẩm trong database."
          />
        )}
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <PackageSearch /> {s.products.length ? 'Đổi / thêm sản phẩm' : 'Chọn sản phẩm'}
        </Button>
        {s.products.length > 1 ? (
          <p className="text-muted-foreground text-xs">
            AI viết cho <strong>sản phẩm chính</strong>.{' '}
            {isCompare
              ? 'Sản phẩm thứ 2–3 dùng để so sánh.'
              : 'Các sản phẩm khác được giữ lại để chuẩn bị tạo hàng loạt (phase sau).'}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard step={2} title="Phong cách nội dung">
        {s.templates.error ? (
          <p className="text-danger text-sm">{s.templates.error}</p>
        ) : (
          <div role="radiogroup" aria-label="Template kịch bản" className="grid gap-1.5">
            {(s.templates.data ?? []).map((t) => {
              const checked = t.id === config.templateId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => update('templateId', t.id)}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-left transition-colors ${
                    checked ? 'border-primary bg-primary/10' : 'hover:bg-accent/60'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {t.name}
                    <span className="text-muted-foreground font-mono text-[10px]">
                      v{t.version}
                    </span>
                  </span>
                  <span className="text-muted-foreground block text-xs">{t.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard step={3} title="Cấu hình">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Thời lượng mục tiêu</span>
          <OptionChips
            label="Thời lượng mục tiêu"
            value={config.durationSeconds}
            onChange={(v) => update('durationSeconds', v)}
            options={SCRIPT_DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Số phiên bản</span>
          <OptionChips
            label="Số phiên bản"
            value={config.variantCount}
            onChange={(v) => update('variantCount', v)}
            options={[1, 3, 5, 10].map((n) => ({
              value: n,
              label: String(n),
              disabled: !s.allowedCounts.includes(n as 1),
              title: s.allowedCounts.includes(n as 1)
                ? undefined
                : 'Vượt giới hạn trong Cài đặt › AI Models',
            }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Field label="Đối tượng khách hàng" htmlFor="sc-audience">
            <NativeSelect
              id="sc-audience"
              value={config.audienceId}
              onChange={(e) => update('audienceId', e.target.value)}
              options={SCRIPT_AUDIENCES.map((a) => ({ value: a.id, label: a.label }))}
            />
          </Field>
          <Field label="Giọng văn" htmlFor="sc-tone">
            <NativeSelect
              id="sc-tone"
              value={config.toneId}
              onChange={(e) => update('toneId', e.target.value)}
              options={SCRIPT_TONES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Phong cách mở đầu" htmlFor="sc-hook">
            <NativeSelect
              id="sc-hook"
              value={config.hookStyleId}
              onChange={(e) => update('hookStyleId', e.target.value)}
              options={HOOK_STYLES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
          <Field label="Phong cách CTA" htmlFor="sc-cta">
            <NativeSelect
              id="sc-cta"
              value={config.ctaStyleId}
              onChange={(e) => update('ctaStyleId', e.target.value)}
              options={CTA_STYLES.map((t) => ({ value: t.id, label: t.label }))}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <div>
            <p className="text-sm font-medium">Cho phép nhắc giá bán</p>
            <p className="text-muted-foreground text-xs">
              Chỉ dùng đúng giá trong database. Giá vốn không bao giờ gửi cho AI.
            </p>
          </div>
          <Switch
            checked={config.includePrice}
            onCheckedChange={(v) => update('includePrice', v)}
            aria-label="Cho phép nhắc giá bán"
          />
        </div>
        <Field label="Ngôn ngữ" htmlFor="sc-lang" hint="Phase 03 chỉ hỗ trợ tiếng Việt">
          <NativeSelect
            id="sc-lang"
            value="vi-VN"
            disabled
            options={[{ value: 'vi-VN', label: 'Tiếng Việt' }]}
          />
        </Field>
      </SectionCard>

      <SectionCard step={4} title="AI provider">
        {s.providers.error ? <p className="text-danger text-sm">{s.providers.error}</p> : null}
        <Field label="Nhà cung cấp" htmlFor="sc-provider">
          <NativeSelect
            id="sc-provider"
            value={config.provider ?? ''}
            onChange={(e) => update('provider', e.target.value as ScriptProviderId)}
            placeholder={providers.length ? 'Chọn provider' : 'Đang tải…'}
            options={providers.map((p) => ({
              value: p.id,
              label: `${p.displayName}${p.status === 'ready' ? '' : ' – chưa cấu hình'}`,
              disabled: p.status !== 'ready',
            }))}
          />
        </Field>
        {s.providerStatus ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <StatusBadge meta={PROVIDER_STATUS_META[s.providerStatus.status]} />
            {s.providerStatus.isMock ? <Badge variant="demo">MOCK – KHÔNG PHẢI AI</Badge> : null}
            <span className="text-muted-foreground">{s.providerStatus.message}</span>
          </div>
        ) : null}
        {s.providerStatus?.models.length ? (
          <Field label="Model" htmlFor="sc-model">
            <NativeSelect
              id="sc-model"
              value={config.model ?? ''}
              onChange={(e) => update('model', e.target.value)}
              options={s.providerStatus.models.map((m) => ({
                value: m.id,
                label: `${m.label}${m.pricingKnown ? '' : ' (chưa có đơn giá)'}`,
              }))}
            />
          </Field>
        ) : null}
        {s.modelInfo?.supportsTemperature ? (
          <Field label={`Độ sáng tạo: ${(config.temperature ?? 0.7).toFixed(1)}`} htmlFor="sc-temp">
            <input
              id="sc-temp"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={config.temperature ?? 0.7}
              onChange={(e) => update('temperature', Number(e.target.value))}
              className="accent-primary"
            />
          </Field>
        ) : null}
      </SectionCard>

      <SectionCard step={5} title="Yêu cầu bổ sung">
        <PromptEditor
          label={needsCustom ? 'Yêu cầu tuỳ chỉnh (bắt buộc)' : 'Prompt bổ sung (tuỳ chọn)'}
          value={config.customInstructions}
          onChange={(v) => update('customInstructions', v)}
          rows={4}
          maxLength={1500}
          placeholder="VD: Nhấn mạnh chất liệu cotton thoáng mát, phù hợp đi làm…"
        />
        <div className="flex flex-wrap gap-1.5">
          <NativeSelect
            aria-label="Dùng prompt đã lưu"
            className="min-w-0 flex-1"
            value=""
            onChange={(e) => {
              const p = presets.data?.find((x) => x.id === e.target.value);
              if (p) update('customInstructions', p.content);
            }}
            placeholder={presets.data?.length ? 'Dùng prompt đã lưu…' : 'Chưa có prompt đã lưu'}
            options={(presets.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!config.customInstructions.trim()}
            onClick={() => void savePreset()}
          >
            <Save /> Lưu prompt
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Yêu cầu bổ sung không thể vượt quy tắc an toàn (không bịa giá, khuyến mãi, công dụng).
        </p>
      </SectionCard>

      <div className="bg-card sticky bottom-0 flex flex-col gap-2 rounded-xl border p-3.5 shadow-xs">
        <div className="text-xs" aria-live="polite">
          {est ? (
            <p>
              Chi phí <strong>ước tính</strong>: ~{usd(est.estimatedCostUsd)} (tối đa{' '}
              {usd(est.maxCostUsd)}) · {est.calls} lời gọi · còn {usd(est.remainingDailyUsd)} hôm
              nay
            </p>
          ) : s.estimate.loading && s.request && s.ready ? (
            <p className="text-muted-foreground">Đang ước tính chi phí…</p>
          ) : s.estimate.error ? (
            <p className="text-danger">{s.estimate.error}</p>
          ) : null}
          {blockers.length ? (
            <p className="mt-1 text-[oklch(0.45_0.11_60)]">{blockers[0]}</p>
          ) : null}
        </div>
        <Button onClick={() => void s.generate()} disabled={generating || blockers.length > 0}>
          {generating ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {generating ? 'Đang tạo…' : `Tạo ${config.variantCount} kịch bản bằng AI`}
        </Button>
        <Button variant="outline" onClick={s.startSample} disabled={generating}>
          <FilePlus2 /> Soạn tay từ khuôn mẫu
        </Button>
      </div>

      <ProductPickerDialog
        key={pickerOpen ? 'open' : 'closed'}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={s.products}
        title="Chọn sản phẩm cho kịch bản"
        onConfirm={(list) => {
          const keep = s.products.filter((p) => list.some((x) => x.id === p.id));
          s.setProducts([...keep, ...list.filter((x) => !keep.some((k) => k.id === x.id))]);
        }}
      />
    </div>
  );
}
