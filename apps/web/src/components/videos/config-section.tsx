'use client';

import { Minus, Plus } from 'lucide-react';
import { ASPECT_RATIOS, VIDEO_DURATIONS, VIDEO_MODES, VIDEO_QUALITIES } from '@acs/shared';
import {
  Field,
  OptionChips,
  SectionCard,
  UnavailableButton,
  UnavailableChip,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { VIDEO_TEMPLATES, VOICES } from '@/lib/data';
import { VIDEO_MODE_META } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { MAX_CONCURRENCY, MAX_VERSIONS } from './factory-types';
import type { VideoFactoryState } from './use-video-factory';

function Stepper({
  id,
  value,
  min,
  max,
  onChange,
  label,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-labelledby={`${id}-label`}>
      <Button
        size="icon-sm"
        variant="outline"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Giảm ${label}`}
      >
        <Minus />
      </Button>
      <output id={id} className="tabular w-9 text-center text-sm font-semibold" aria-live="polite">
        {value}
      </output>
      <Button
        size="icon-sm"
        variant="outline"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Tăng ${label}`}
      >
        <Plus />
      </Button>
    </div>
  );
}

/** Khu vực 2: Cấu hình video. */
export function ConfigSection({ state }: { state: VideoFactoryState }) {
  const { config, update } = state;
  return (
    <SectionCard step={2} title="Cấu hình video">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tỷ lệ khung hình</span>
        <OptionChips
          label="Tỷ lệ khung hình"
          value={config.aspectRatio}
          onChange={(v) => update('aspectRatio', v)}
          options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Thời lượng mục tiêu</span>
        <OptionChips
          label="Thời lượng mục tiêu"
          value={config.durationSec}
          onChange={(v) => update('durationSec', v)}
          options={VIDEO_DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Chất lượng xuất</span>
        <OptionChips
          label="Chất lượng xuất"
          value={config.quality}
          onChange={(v) => update('quality', v)}
          options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q }))}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">Chế độ tạo</legend>
        <div className="flex flex-col gap-1.5">
          {VIDEO_MODES.map((mode) => {
            const meta = VIDEO_MODE_META[mode];
            const checked = config.mode === mode;
            return (
              <label
                key={mode}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors has-focus-visible:ring-[3px] has-focus-visible:ring-ring/40',
                  checked ? 'border-primary bg-primary/8' : 'hover:bg-accent/60',
                )}
              >
                <input
                  type="radio"
                  name="vf-mode"
                  value={mode}
                  checked={checked}
                  onChange={() => update('mode', mode)}
                  className="accent-[var(--primary)] mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[13px] font-medium">{meta.label}</span>
                    <UnavailableChip
                      reason={meta.availability}
                      label={mode === 'image_slideshow' ? 'Phase 06' : 'Chưa khả dụng'}
                    />
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                    {meta.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-muted-foreground text-xs">
          Chưa có chế độ nào được backend hỗ trợ ở Phase 01 – lựa chọn chỉ được lưu vào cấu hình
          nháp.
        </p>
      </fieldset>

      <Field label="Giọng đọc" htmlFor="vf-voice">
        <div className="flex gap-2">
          <NativeSelect
            id="vf-voice"
            className="flex-1"
            value={config.voiceId}
            onChange={(e) => update('voiceId', e.target.value)}
            options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
          />
          <UnavailableButton
            size="sm"
            variant="outline"
            reason="Nghe thử cần TTS provider – dự kiến Phase 05"
            className="h-9"
          >
            Nghe thử
          </UnavailableButton>
        </div>
      </Field>
      <Field label="Template video" htmlFor="vf-video-template">
        <NativeSelect
          id="vf-video-template"
          value={config.templateId}
          onChange={(e) => update('templateId', e.target.value)}
          options={VIDEO_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span id="vf-concurrency-label" className="text-sm font-medium">
            Luồng song song
          </span>
          <Stepper
            id="vf-concurrency"
            label="số luồng"
            value={config.concurrency}
            min={1}
            max={MAX_CONCURRENCY}
            onChange={(v) => update('concurrency', v)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="vf-versions-label" className="text-sm font-medium">
            Phiên bản / sản phẩm
          </span>
          <Stepper
            id="vf-versions"
            label="số phiên bản"
            value={config.versionsPerProduct}
            min={1}
            max={MAX_VERSIONS}
            onChange={(v) => update('versionsPerProduct', v)}
          />
        </div>
      </div>
    </SectionCard>
  );
}
