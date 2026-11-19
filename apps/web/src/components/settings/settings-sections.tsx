'use client';

import { CircleCheck, CircleX, Link2, PlugZap } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ASPECT_RATIOS,
  type AppPreferences,
  type AppSettings,
  type AppSettingsUpdate,
  DEFAULT_DISPLAY_TIMEZONE,
  type HealthResponse,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_QUALITIES,
  healthResponseSchema,
} from '@acs/shared';
import { EmptyState, Field, UnavailableButton } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiRequest, describeError } from '@/lib/api/client';
import { VIDEO_TEMPLATES, VOICES } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { ASPECT_RATIO_LABEL, VIDEO_MODE_META } from '@/lib/labels';
import { SecretInput } from './secret-input';

export interface SectionProps {
  settings: AppSettings;
  onSave: (patch: AppSettingsUpdate) => Promise<void>;
}

const grid = 'grid gap-4 sm:grid-cols-2';

/** Nút lưu dùng chung cho nhóm cài đặt có lưu được. */
function SaveBar({
  dirty,
  saving,
  onSave,
  updatedAt,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  updatedAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t pt-4">
      <Button onClick={onSave} disabled={!dirty || saving}>
        {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
      </Button>
      <span className="text-muted-foreground text-xs">
        {dirty
          ? 'Có thay đổi chưa lưu'
          : updatedAt
            ? `Đã lưu · cập nhật ${formatDateTime(updatedAt)}`
            : ''}
      </span>
    </div>
  );
}

/** State form cho 1 nhóm preferences + lưu bằng bản vá (API deep-merge). */
function useGroup<K extends keyof AppPreferences>({ settings, onSave }: SectionProps, key: K) {
  const [value, setValue] = useState<AppPreferences[K]>(settings.preferences[key]);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(value) !== JSON.stringify(settings.preferences[key]);
  const patch = <F extends keyof AppPreferences[K]>(field: F, v: AppPreferences[K][F]) =>
    setValue((cur) => ({ ...cur, [field]: v }));
  const save = async (extra: AppSettingsUpdate = {}) => {
    setSaving(true);
    try {
      await onSave({ ...extra, preferences: { [key]: value } });
    } finally {
      setSaving(false);
    }
  };
  return { value, patch, dirty, saving, save };
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value))))}
      />
    </Field>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
  disabledReason,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabledReason?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={Boolean(disabledReason)}
        aria-label={label}
        title={disabledReason}
      />
    </div>
  );
}

export function GeneralSettings({ settings, onSave }: SectionProps) {
  const [name, setName] = useState(settings.workspaceName);
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Tên workspace" htmlFor="st-ws">
          <Input
            id="st-ws"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </Field>
        <Field label="Ngôn ngữ giao diện" htmlFor="st-lang" hint="Hiện chỉ hỗ trợ tiếng Việt">
          <NativeSelect
            id="st-lang"
            value="vi-VN"
            disabled
            options={[{ value: 'vi-VN', label: 'Tiếng Việt' }]}
          />
        </Field>
        <Field label="Múi giờ hiển thị" htmlFor="st-tz" hint="Dữ liệu luôn được lưu ở UTC">
          <Input id="st-tz" value={`${DEFAULT_DISPLAY_TIMEZONE} (UTC+7)`} readOnly />
        </Field>
        <Field label="Đơn vị tiền tệ mặc định" htmlFor="st-cur">
          <Input id="st-cur" value="VND (₫)" readOnly />
        </Field>
      </div>
      <SaveBar
        dirty={name.trim() !== settings.workspaceName}
        saving={saving}
        updatedAt={settings.updatedAt}
        onSave={async () => {
          setSaving(true);
          try {
            await onSave({ workspaceName: name.trim() });
          } finally {
            setSaving(false);
          }
        }}
      />
    </div>
  );
}

export function AccountSettings(_props: Partial<SectionProps>) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        className="py-8"
        title="Chưa có hệ thống tài khoản"
        description="API đang chạy chế độ phát triển (dev-local): chưa đăng nhập, chỉ truy cập từ máy cục bộ. Tài khoản & phân quyền dự kiến ở Phase 09."
      />
      <UnavailableButton
        variant="outline"
        reason="Đăng nhập & đổi mật khẩu cần hệ thống xác thực – dự kiến Phase 09"
        className="self-start"
      >
        Đổi mật khẩu
      </UnavailableButton>
    </div>
  );
}

const PROVIDERS = [
  { id: 'anthropic', name: 'Anthropic', use: 'Kịch bản (LLM)', env: 'ANTHROPIC_API_KEY' },
  { id: 'openai', name: 'OpenAI', use: 'Kịch bản / ảnh', env: 'OPENAI_API_KEY' },
  { id: 'google', name: 'Google AI', use: 'Ảnh / video', env: 'GOOGLE_API_KEY' },
  { id: 'elevenlabs', name: 'ElevenLabs', use: 'Giọng đọc (TTS)', env: 'ELEVENLABS_API_KEY' },
];

export function ProviderSettings(_props: Partial<SectionProps>) {
  return (
    <ul className="flex flex-col gap-3">
      {PROVIDERS.map((p) => (
        <li key={p.id} className="rounded-xl border p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <PlugZap className="text-muted-foreground size-4" aria-hidden />
            <p className="font-medium">{p.name}</p>
            <span className="text-muted-foreground text-xs">· {p.use}</span>
            <Badge variant="neutral" className="ml-auto">
              Chưa kiểm tra
            </Badge>
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
            <SecretInput label="API key" envName={p.env} />
            <UnavailableButton
              variant="outline"
              reason="Kiểm tra kết nối cần endpoint server – dự kiến Phase 03"
              className="sm:mb-5"
            >
              Kiểm tra kết nối
            </UnavailableButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ModelSettings(_props: Partial<SectionProps>) {
  const rows = [
    { id: 'script', label: 'Mô hình viết kịch bản', env: 'AI_SCRIPT_PROVIDER' },
    { id: 'image', label: 'Mô hình tạo ảnh', env: 'AI_IMAGE_PROVIDER' },
    { id: 'tts', label: 'Mô hình giọng đọc', env: 'AI_TTS_PROVIDER' },
    { id: 'video', label: 'Mô hình AI video', env: 'AI_VIDEO_PROVIDER' },
  ];
  return (
    <div className={grid}>
      {rows.map((r) => (
        <Field
          key={r.id}
          label={r.label}
          htmlFor={`st-model-${r.id}`}
          hint={`Cấu hình ở server: ${r.env}`}
        >
          <NativeSelect
            id={`st-model-${r.id}`}
            value=""
            disabled
            placeholder="Chưa có provider (Phase 03–06)"
            options={[]}
          />
        </Field>
      ))}
    </div>
  );
}

export function VoiceSettings(props: SectionProps) {
  const g = useGroup(props, 'voice');
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Giọng đọc mặc định" htmlFor="st-voice">
          <NativeSelect
            id="st-voice"
            value={g.value.voiceId}
            onChange={(e) => g.patch('voiceId', e.target.value)}
            options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
          />
        </Field>
        <Field label="Tốc độ đọc" htmlFor="st-speed">
          <NativeSelect
            id="st-speed"
            value={String(g.value.speed)}
            onChange={(e) => g.patch('speed', Number(e.target.value))}
            options={['0.8', '0.9', '1', '1.1', '1.2'].map((v) => ({ value: v, label: `${v}x` }))}
          />
        </Field>
      </div>
      <UnavailableButton
        variant="outline"
        reason="Nghe thử cần TTS provider – dự kiến Phase 05"
        className="self-start"
      >
        Nghe thử giọng đọc
      </UnavailableButton>
      <SaveBar
        dirty={g.dirty}
        saving={g.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void g.save()}
      />
    </div>
  );
}

export function VideoDefaultSettings(props: SectionProps) {
  const g = useGroup(props, 'videoDefaults');
  const [mode, setMode] = useState(props.settings.defaultVideoMode);
  const dirty = g.dirty || mode !== props.settings.defaultVideoMode;
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Chế độ tạo mặc định" htmlFor="st-mode">
          <NativeSelect
            id="st-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            options={VIDEO_MODES.map((m) => ({ value: m, label: VIDEO_MODE_META[m].label }))}
          />
        </Field>
        <Field label="Tỷ lệ khung hình" htmlFor="st-aspect">
          <NativeSelect
            id="st-aspect"
            value={g.value.aspectRatio}
            onChange={(e) => g.patch('aspectRatio', e.target.value as typeof g.value.aspectRatio)}
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: ASPECT_RATIO_LABEL[r] }))}
          />
        </Field>
        <Field label="Thời lượng mặc định" htmlFor="st-duration">
          <NativeSelect
            id="st-duration"
            value={String(g.value.durationSec)}
            onChange={(e) => g.patch('durationSec', Number(e.target.value))}
            options={VIDEO_DURATIONS.map((d) => ({ value: String(d), label: `${d} giây` }))}
          />
        </Field>
        <Field label="Chất lượng xuất" htmlFor="st-quality">
          <NativeSelect
            id="st-quality"
            value={g.value.quality}
            onChange={(e) => g.patch('quality', e.target.value as typeof g.value.quality)}
            options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q }))}
          />
        </Field>
        <Field label="Template video" htmlFor="st-vtpl">
          <NativeSelect
            id="st-vtpl"
            value={g.value.templateId}
            onChange={(e) => g.patch('templateId', e.target.value)}
            options={VIDEO_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
      </div>
      <SwitchRow
        label="Tự động thêm phụ đề"
        hint="Phụ đề sinh từ lời thoại"
        checked={g.value.subtitles}
        onChange={(v) => g.patch('subtitles', v)}
      />
      <SwitchRow
        label="Chèn watermark thương hiệu"
        hint="Logo góc trên bên phải"
        checked={g.value.watermark}
        onChange={(v) => g.patch('watermark', v)}
      />
      <SaveBar
        dirty={dirty}
        saving={g.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void g.save({ defaultVideoMode: mode })}
      />
    </div>
  );
}

export function StorageSettings(props: SectionProps) {
  const g = useGroup(props, 'storage');
  const [state, setState] = useState<{ data?: HealthResponse; error?: string; loading: boolean }>({
    loading: true,
  });
  useEffect(() => {
    let active = true;
    apiRequest<HealthResponse>('/health', { schema: healthResponseSchema, timeoutMs: 8000 })
      .then((data) => active && setState({ data, loading: false }))
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          loading: false,
          error:
            error instanceof ApiError && error.status === 503
              ? 'Một hoặc nhiều dịch vụ lõi đang down'
              : describeError(error),
        });
      });
    return () => {
      active = false;
    };
  }, []);
  const storage = state.data?.components.storage;
  const bucket = storage?.details?.bucket;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-4">
        <p className="mb-2 font-medium">Trạng thái storage (dữ liệu thật từ /health)</p>
        {state.loading ? (
          <p className="text-muted-foreground text-sm">Đang kiểm tra…</p>
        ) : storage ? (
          <p className="flex items-center gap-2 text-sm">
            {storage.status === 'up' ? (
              <CircleCheck className="text-success size-4" />
            ) : (
              <CircleX className="text-danger size-4" />
            )}
            MinIO {storage.status === 'up' ? 'sẵn sàng' : 'không khả dụng'}
            {typeof bucket === 'string' ? (
              <>
                {' '}
                · bucket <code className="bg-muted rounded px-1 font-mono text-xs">{bucket}</code>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-danger text-sm">{state.error}</p>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Endpoint, bucket và khoá truy cập được cấu hình ở server (
        <code className="bg-muted rounded px-1 font-mono text-xs">S3_*</code>,{' '}
        <code className="bg-muted rounded px-1 font-mono text-xs">MEDIA_MAX_UPLOAD_MB</code>). Giao
        diện không hiển thị các giá trị bí mật.
      </p>
      <div className={grid}>
        <NumberField
          id="st-retain"
          label="Giữ file tạm (ngày)"
          value={g.value.tempRetentionDays}
          min={1}
          max={365}
          onChange={(v) => g.patch('tempRetentionDays', v)}
          hint="Áp dụng cho file trung gian khi render (Phase 06)"
        />
      </div>
      <SaveBar
        dirty={g.dirty}
        saving={g.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void g.save()}
      />
    </div>
  );
}

export function BatchSettings(props: SectionProps) {
  const g = useGroup(props, 'batch');
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <NumberField
          id="st-conc"
          label="Luồng song song mặc định"
          value={g.value.concurrency}
          min={1}
          max={8}
          onChange={(v) => g.patch('concurrency', v)}
          hint="Tối đa 8"
        />
        <NumberField
          id="st-retry"
          label="Số lần thử lại khi lỗi"
          value={g.value.retries}
          min={0}
          max={10}
          onChange={(v) => g.patch('retries', v)}
        />
        <NumberField
          id="st-backoff"
          label="Thời gian chờ giữa các lần thử (giây)"
          value={g.value.backoffSec}
          min={1}
          max={3600}
          onChange={(v) => g.patch('backoffSec', v)}
        />
        <NumberField
          id="st-maxbatch"
          label="Giới hạn video mỗi batch"
          value={g.value.maxPerBatch}
          min={1}
          max={1000}
          onChange={(v) => g.patch('maxPerBatch', v)}
        />
      </div>
      <SwitchRow
        label="Tạm dừng batch khi tỉ lệ lỗi > 30%"
        checked={g.value.pauseOnHighErrorRate}
        onChange={(v) => g.patch('pauseOnHighErrorRate', v)}
      />
      <SaveBar
        dirty={g.dirty}
        saving={g.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void g.save()}
      />
    </div>
  );
}

export function CostSettings(props: SectionProps) {
  const g = useGroup(props, 'cost');
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed p-4">
        <p className="text-sm font-medium">Chi phí tháng này</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Chưa có dữ liệu – chưa tích hợp provider AI nào.
        </p>
      </div>
      <div className={grid}>
        <NumberField
          id="st-budget"
          label="Ngân sách tháng (USD)"
          value={g.value.monthlyBudgetUsd}
          min={0}
          max={1_000_000}
          onChange={(v) => g.patch('monthlyBudgetUsd', v)}
        />
        <NumberField
          id="st-alert"
          label="Cảnh báo khi đạt (%)"
          value={g.value.alertPercent}
          min={1}
          max={100}
          onChange={(v) => g.patch('alertPercent', v)}
        />
      </div>
      <SwitchRow
        label="Dừng tạo nội dung khi vượt ngân sách"
        hint="Ngăn phát sinh chi phí ngoài kế hoạch"
        checked={g.value.hardStop}
        onChange={(v) => g.patch('hardStop', v)}
      />
      <SaveBar
        dirty={g.dirty}
        saving={g.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void g.save()}
      />
    </div>
  );
}

export function TikTokSettings(_props: Partial<SectionProps>) {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        className="py-8"
        title="Chưa kết nối tài khoản TikTok nào"
        description="Kết nối bằng OAuth phía server (client secret chỉ nằm ở server) – dự kiến Phase 08."
      />
      <UnavailableButton
        reason="Kết nối TikTok cần OAuth phía server – dự kiến Phase 08"
        className="self-start"
      >
        <Link2 /> Kết nối tài khoản TikTok
      </UnavailableButton>
    </div>
  );
}
