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
  IMAGE_ASPECTS,
  type ImageProviderId,
  type ScriptProviderId,
  VIDEO_DURATIONS,
  VIDEO_MODES,
  VIDEO_QUALITIES,
  healthResponseSchema,
} from '@acs/shared';
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  StatusBadge,
  UnavailableButton,
} from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiRequest, describeError } from '@/lib/api/client';
import { useAsync } from '@/hooks/use-async';
import { VIDEO_TEMPLATES, VOICES, imageRepository, scriptRepository } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import {
  AI_FEATURE_LABEL,
  AI_USAGE_STATUS_META,
  ASPECT_RATIO_LABEL,
  PROVIDER_STATUS_META,
  VIDEO_MODE_META,
} from '@/lib/labels';

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

/** Provider chưa tích hợp (phase sau) – chỉ hiển thị biến môi trường dự kiến. */
const FUTURE_PROVIDERS = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    use: 'Giọng đọc (TTS) – Phase 05',
    env: 'ELEVENLABS_API_KEY',
  },
];

const code = (s: string) => (
  <code key={s} className="bg-muted rounded px-1 font-mono text-xs">
    {s}
  </code>
);

/**
 * Trạng thái THẬT của AI provider (từ API). API key chỉ cấu hình bằng biến môi trường server –
 * giao diện không có ô nhập key và không bao giờ nhận lại giá trị key.
 */
export function ProviderSettings(_props: Partial<SectionProps>) {
  const scriptProviders = useAsync(() => scriptRepository.providers(), []);
  const imageProviders = useAsync(() => imageRepository.providers(), []);
  const [checks, setChecks] = useState<
    Record<string, { ok: boolean; message: string } | 'loading'>
  >({});
  const check = async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
    setChecks((c) => ({ ...c, [key]: 'loading' }));
    try {
      const r = await fn();
      setChecks((c) => ({ ...c, [key]: r }));
    } catch (error) {
      setChecks((c) => ({ ...c, [key]: { ok: false, message: describeError(error) } }));
    }
  };
  const providers = {
    error: scriptProviders.error ?? imageProviders.error,
    reload: () => {
      scriptProviders.reload();
      imageProviders.reload();
    },
    data:
      scriptProviders.data && imageProviders.data
        ? {
            providers: [
              ...scriptProviders.data.providers.map((p) => ({
                ...p,
                key: `script:${p.id}`,
                use: 'Kịch bản (Phase 03)',
                run: () => scriptRepository.checkProvider(p.id as ScriptProviderId),
              })),
              ...imageProviders.data.providers.map((p) => ({
                ...p,
                key: `image:${p.id}`,
                use: 'Ảnh AI (Phase 04)',
                run: () => imageRepository.checkProvider(p.id as ImageProviderId),
              })),
            ],
          }
        : undefined,
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        API key được đặt trong file {code('.env')} của server rồi khởi động lại API. Giao diện không
        nhận, không lưu và không hiển thị API key.
      </p>
      {providers.error ? <ErrorState message={providers.error} onRetry={providers.reload} /> : null}
      {!providers.data && !providers.error ? <LoadingState variant="block" /> : null}
      <ul className="flex flex-col gap-3">
        {(providers.data?.providers ?? []).map((p) => {
          const r = checks[p.key];
          return (
            <li key={p.key} className="rounded-xl border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <PlugZap className="text-muted-foreground size-4" aria-hidden />
                <p className="font-medium">{p.displayName}</p>
                <span className="text-muted-foreground text-xs">· {p.use}</span>
                {p.isMock ? <Badge variant="demo">KHÔNG PHẢI AI</Badge> : null}
                <span className="ml-auto">
                  <StatusBadge meta={PROVIDER_STATUS_META[p.status]} />
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{p.message}</p>
              <p className="text-muted-foreground mt-1 flex flex-wrap gap-1 text-xs">
                Biến môi trường: {p.envVars.map(code)}
              </p>
              {p.defaultModel ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  Model mặc định: {code(p.defaultModel)}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={p.status !== 'ready' || r === 'loading'}
                  aria-label={`Kiểm tra kết nối ${p.displayName} – ${p.use}`}
                  onClick={() => void check(p.key, p.run)}
                >
                  {r === 'loading' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
                </Button>
                {r && r !== 'loading' ? (
                  <span
                    className={`flex items-center gap-1 text-sm ${r.ok ? 'text-success' : 'text-danger'}`}
                    role="status"
                  >
                    {r.ok ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}{' '}
                    {r.message}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
        {FUTURE_PROVIDERS.map((p) => (
          <li key={p.id} className="rounded-xl border border-dashed p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PlugZap className="text-muted-foreground size-4" aria-hidden />
              <p className="font-medium">{p.name}</p>
              <span className="text-muted-foreground text-xs">· {p.use}</span>
              <Badge variant="neutral" className="ml-auto">
                Chưa tích hợp
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Biến môi trường dự kiến: {code(p.env)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Model & giới hạn của AI Script Engine (lưu DB, nhóm preferences.ai). */
export function ModelSettings(props: SectionProps) {
  const g = useGroup(props, 'ai');
  const gi = useGroup(props, 'images');
  const [saving, setSaving] = useState(false);
  const saveBoth = async () => {
    setSaving(true);
    try {
      await props.onSave({ preferences: { ai: g.value, images: gi.value } });
    } finally {
      setSaving(false);
    }
  };
  const providers = useAsync(() => scriptRepository.providers(), []);
  const imgProviders = useAsync(() => imageRepository.providers(), []);
  const templates = useAsync(() => scriptRepository.templates(), []);
  const list = providers.data?.providers ?? [];
  const current = list.find((p) => p.id === g.value.defaultProvider);
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field
          label="Provider viết kịch bản mặc định"
          htmlFor="st-ai-provider"
          hint="Để trống = provider đầu tiên đã cấu hình"
        >
          <NativeSelect
            id="st-ai-provider"
            value={g.value.defaultProvider ?? ''}
            onChange={(e) => {
              g.patch(
                'defaultProvider',
                (e.target.value || null) as AppPreferences['ai']['defaultProvider'],
              );
              g.patch('defaultModel', null);
            }}
            placeholder="Tự động"
            options={list.map((p) => ({
              value: p.id,
              label: `${p.displayName}${p.status === 'ready' ? '' : ' (chưa cấu hình)'}`,
            }))}
          />
        </Field>
        <Field label="Model mặc định" htmlFor="st-ai-model">
          <NativeSelect
            id="st-ai-model"
            value={g.value.defaultModel ?? ''}
            disabled={!current}
            onChange={(e) => g.patch('defaultModel', e.target.value || null)}
            placeholder={
              current
                ? `Mặc định của provider (${current.defaultModel ?? '—'})`
                : 'Chọn provider trước'
            }
            options={(current?.models ?? []).map((m) => ({ value: m.id, label: m.label }))}
          />
        </Field>
        <Field label="Template kịch bản mặc định" htmlFor="st-ai-tpl">
          <NativeSelect
            id="st-ai-tpl"
            value={g.value.defaultTemplateId}
            onChange={(e) => g.patch('defaultTemplateId', e.target.value)}
            options={(
              templates.data ?? [{ id: g.value.defaultTemplateId, name: g.value.defaultTemplateId }]
            ).map((t) => ({
              value: t.id,
              label: t.name,
            }))}
          />
        </Field>
        <NumberField
          id="st-ai-maxvar"
          label="Số phiên bản tối đa mỗi lần tạo"
          value={g.value.maxVariants}
          min={1}
          max={10}
          onChange={(v) => g.patch('maxVariants', v)}
        />
        <NumberField
          id="st-ai-conc"
          label="Số lời gọi AI đồng thời"
          value={g.value.maxConcurrentRequests}
          min={1}
          max={5}
          onChange={(v) => g.patch('maxConcurrentRequests', v)}
          hint="Trong một lần tạo nhiều phiên bản"
        />
      </div>
      <SwitchRow
        label="Mặc định cho phép nhắc giá bán trong kịch bản"
        hint="Giá vốn không bao giờ được gửi cho AI"
        checked={g.value.includePriceByDefault}
        onChange={(v) => g.patch('includePriceByDefault', v)}
      />
      <h3 className="border-t pt-4 text-sm font-semibold">Ảnh AI (Phase 04)</h3>
      <div className={grid}>
        <Field
          label="Provider tạo ảnh mặc định"
          htmlFor="st-img-provider"
          hint="Để trống = provider đầu tiên đã cấu hình"
        >
          <NativeSelect
            id="st-img-provider"
            value={gi.value.defaultProvider ?? ''}
            onChange={(e) =>
              gi.patch(
                'defaultProvider',
                (e.target.value || null) as AppPreferences['images']['defaultProvider'],
              )
            }
            placeholder="Tự động"
            options={(imgProviders.data?.providers ?? []).map((p) => ({
              value: p.id,
              label: `${p.displayName}${p.status === 'ready' ? '' : ' (chưa cấu hình)'}`,
            }))}
          />
        </Field>
        <Field label="Tỷ lệ ảnh mặc định" htmlFor="st-img-aspect" hint="9:16 phù hợp video TikTok">
          <NativeSelect
            id="st-img-aspect"
            value={gi.value.defaultAspect}
            onChange={(e) =>
              gi.patch('defaultAspect', e.target.value as AppPreferences['images']['defaultAspect'])
            }
            options={IMAGE_ASPECTS.map((a) => ({ value: a, label: a }))}
          />
        </Field>
      </div>
      <SwitchRow
        label="Chế độ kiểm duyệt ảnh cho video"
        hint="Bật: chỉ ảnh AI ĐÃ DUYỆT (so sánh với ảnh gốc) mới được dùng làm đầu vào Video Factory"
        checked={gi.value.requireApprovalForVideo}
        onChange={(v) => gi.patch('requireApprovalForVideo', v)}
      />
      <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        Mô hình giọng đọc và video sẽ được thêm ở Phase 05–07.
      </div>
      <SaveBar
        dirty={g.dirty || gi.dirty}
        saving={saving}
        updatedAt={props.settings.updatedAt}
        onSave={() => void saveBoth()}
      />
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
  const cost = useGroup(props, 'cost');
  const ai = useGroup(props, 'ai');
  const usage = useAsync(() => scriptRepository.usageSummary(), [props.settings.updatedAt ?? '']);
  const u = usage.data;
  const money = (s: string) => `$${Number(s).toFixed(4)}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border p-4">
        <p className="text-sm font-medium">
          Chi phí AI (ước tính theo đơn giá cấu hình – không phải hoá đơn)
        </p>
        {usage.error ? (
          <p className="text-danger mt-1 text-sm">{usage.error}</p>
        ) : !u ? (
          <p className="text-muted-foreground mt-1 text-sm">Đang tải…</p>
        ) : (
          <>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Hôm nay (giờ VN)</dt>
                <dd className="tabular font-semibold">
                  {money(u.today.estimatedCostUsd)} / ${u.budgets.dailyUsd} · {u.today.calls} lời
                  gọi
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Tháng này</dt>
                <dd className="tabular font-semibold">
                  {money(u.month.estimatedCostUsd)} / ${u.budgets.monthlyUsd} · {u.month.calls} lời
                  gọi
                </dd>
              </div>
            </dl>
            {u.recent.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs" aria-label="Lời gọi AI gần đây">
                  <thead className="text-muted-foreground text-left">
                    <tr>
                      <th className="py-1 font-medium">Thời điểm</th>
                      <th className="py-1 font-medium">Chức năng</th>
                      <th className="py-1 font-medium">Provider / model</th>
                      <th className="py-1 text-right font-medium">Token vào/ra</th>
                      <th className="py-1 text-right font-medium">Ước tính</th>
                      <th className="py-1 text-right font-medium">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.recent.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1">{formatDateTime(r.createdAt)}</td>
                        <td className="py-1">{AI_FEATURE_LABEL[r.feature] ?? r.feature}</td>
                        <td className="py-1">
                          {r.provider}/{r.model}
                        </td>
                        <td className="tabular py-1 text-right">
                          {r.inputTokens ?? '—'}/{r.outputTokens ?? '—'}
                        </td>
                        <td className="tabular py-1 text-right">
                          {r.estimatedCostUsd ? money(r.estimatedCostUsd) : '—'}
                        </td>
                        <td className="py-1 text-right">
                          <StatusBadge
                            meta={
                              AI_USAGE_STATUS_META[r.status] ?? { label: r.status, tone: 'neutral' }
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">Chưa có lời gọi AI nào.</p>
            )}
          </>
        )}
      </div>
      <div className={grid}>
        <NumberField
          id="st-ai-pergen"
          label="Ngân sách mỗi lần tạo (USD)"
          value={ai.value.perGenerationBudgetUsd}
          min={0}
          max={1000}
          step={0.1}
          onChange={(v) => ai.patch('perGenerationBudgetUsd', v)}
          hint="Lần tạo có chi phí ước tính lớn hơn sẽ bị từ chối"
        />
        <NumberField
          id="st-ai-daily"
          label="Ngân sách AI mỗi ngày (USD)"
          value={ai.value.dailyBudgetUsd}
          min={0}
          max={10_000}
          step={0.5}
          onChange={(v) => ai.patch('dailyBudgetUsd', v)}
        />
        <NumberField
          id="st-budget"
          label="Ngân sách tháng (USD)"
          value={cost.value.monthlyBudgetUsd}
          min={0}
          max={1_000_000}
          onChange={(v) => cost.patch('monthlyBudgetUsd', v)}
        />
        <NumberField
          id="st-alert"
          label="Cảnh báo khi đạt (%)"
          value={cost.value.alertPercent}
          min={1}
          max={100}
          onChange={(v) => cost.patch('alertPercent', v)}
        />
      </div>
      <SwitchRow
        label="Dừng tạo nội dung khi vượt ngân sách tháng"
        hint="Ngăn phát sinh chi phí ngoài kế hoạch (ngân sách ngày và mỗi lần tạo luôn được áp dụng)"
        checked={cost.value.hardStop}
        onChange={(v) => cost.patch('hardStop', v)}
      />
      <SaveBar
        dirty={cost.dirty || ai.dirty}
        saving={cost.saving || ai.saving}
        updatedAt={props.settings.updatedAt}
        onSave={() =>
          void props
            .onSave({ preferences: { cost: cost.value, ai: ai.value } })
            .catch(() => undefined)
        }
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
