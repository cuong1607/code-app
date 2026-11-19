'use client';

import { CircleCheck, CircleX, Link2, PlugZap, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  ASPECT_RATIOS,
  DEFAULT_DISPLAY_TIMEZONE,
  type HealthResponse,
  VIDEO_DURATIONS,
  VIDEO_QUALITIES,
  healthResponseSchema,
} from '@acs/shared';
import { DemoBadge, Field, UnavailableButton, UnavailableChip } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { ApiError, apiRequest, describeError } from '@/lib/api/client';
import { DEMO_USER, DEMO_WORKSPACE, TIKTOK_ACCOUNTS, VIDEO_TEMPLATES, VOICES } from '@/lib/data';
import { ASPECT_RATIO_LABEL } from '@/lib/labels';
import { SecretInput } from './secret-input';

function SwitchRow({
  label,
  hint,
  defaultChecked,
  disabledReason,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabledReason?: string;
}) {
  const [checked, setChecked] = useState(Boolean(defaultChecked));
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {disabledReason ? <UnavailableChip reason={disabledReason} /> : null}
        <Switch
          checked={checked}
          onCheckedChange={setChecked}
          disabled={Boolean(disabledReason)}
          aria-label={label}
        />
      </div>
    </div>
  );
}

const grid = 'grid gap-4 sm:grid-cols-2';

export function GeneralSettings() {
  return (
    <div className={grid}>
      <Field label="Tên workspace" htmlFor="st-ws" badge={<DemoBadge />}>
        <Input id="st-ws" defaultValue={DEMO_WORKSPACE.name} />
      </Field>
      <Field label="Ngôn ngữ giao diện" htmlFor="st-lang" hint="Phase 01 chỉ hỗ trợ tiếng Việt">
        <NativeSelect
          id="st-lang"
          defaultValue="vi-VN"
          options={[
            { value: 'vi-VN', label: 'Tiếng Việt' },
            { value: 'en-US', label: 'English (chưa hỗ trợ)', disabled: true },
          ]}
        />
      </Field>
      <Field label="Múi giờ hiển thị" htmlFor="st-tz" hint="Dữ liệu luôn được lưu ở UTC">
        <Input id="st-tz" value={`${DEFAULT_DISPLAY_TIMEZONE} (UTC+7)`} readOnly />
      </Field>
      <Field label="Đơn vị tiền tệ" htmlFor="st-cur">
        <Input id="st-cur" value="VND (₫)" readOnly />
      </Field>
    </div>
  );
}

export function AccountSettings() {
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Họ tên" htmlFor="st-name" badge={<DemoBadge />}>
          <Input id="st-name" defaultValue={DEMO_USER.name} />
        </Field>
        <Field label="Email" htmlFor="st-email">
          <Input id="st-email" type="email" defaultValue={DEMO_USER.email} />
        </Field>
        <Field label="Vai trò" htmlFor="st-role">
          <Input id="st-role" value={DEMO_USER.role} readOnly />
        </Field>
      </div>
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

export function ProviderSettings() {
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

export function ModelSettings() {
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
          hint={`Biến môi trường: ${r.env}`}
        >
          <NativeSelect
            id={`st-model-${r.id}`}
            defaultValue=""
            placeholder="Chưa chọn – cần cấu hình provider"
            options={[]}
          />
        </Field>
      ))}
    </div>
  );
}

export function VoiceSettings() {
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Giọng đọc mặc định" htmlFor="st-voice">
          <NativeSelect
            id="st-voice"
            defaultValue={VOICES[0]!.id}
            options={VOICES.map((v) => ({ value: v.id, label: v.name }))}
          />
        </Field>
        <Field label="Tốc độ đọc" htmlFor="st-speed">
          <NativeSelect
            id="st-speed"
            defaultValue="1"
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
    </div>
  );
}

export function VideoDefaultSettings() {
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Tỷ lệ khung hình" htmlFor="st-aspect">
          <NativeSelect
            id="st-aspect"
            defaultValue="9:16"
            options={ASPECT_RATIOS.map((r) => ({ value: r, label: ASPECT_RATIO_LABEL[r] }))}
          />
        </Field>
        <Field label="Thời lượng mặc định" htmlFor="st-duration">
          <NativeSelect
            id="st-duration"
            defaultValue="30"
            options={VIDEO_DURATIONS.map((d) => ({ value: String(d), label: `${d} giây` }))}
          />
        </Field>
        <Field label="Chất lượng xuất" htmlFor="st-quality">
          <NativeSelect
            id="st-quality"
            defaultValue="1080p"
            options={VIDEO_QUALITIES.map((q) => ({ value: q, label: q }))}
          />
        </Field>
        <Field label="Template video" htmlFor="st-vtpl">
          <NativeSelect
            id="st-vtpl"
            defaultValue={VIDEO_TEMPLATES[0].id}
            options={VIDEO_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
          />
        </Field>
      </div>
      <SwitchRow label="Tự động thêm phụ đề" hint="Phụ đề sinh từ lời thoại" defaultChecked />
      <SwitchRow label="Chèn watermark thương hiệu" hint="Logo góc trên bên phải" />
    </div>
  );
}

export function StorageSettings() {
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
        <div className="mb-2 flex items-center gap-2">
          <p className="font-medium">Trạng thái storage (dữ liệu thật từ /health)</p>
        </div>
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
            {storage.latencyMs !== undefined ? (
              <span className="text-muted-foreground">· {storage.latencyMs} ms</span>
            ) : null}
          </p>
        ) : (
          <p className="text-danger text-sm">{state.error}</p>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        Endpoint, bucket và khoá truy cập được cấu hình ở server qua{' '}
        <code className="bg-muted rounded px-1 font-mono text-xs">S3_ENDPOINT</code>,{' '}
        <code className="bg-muted rounded px-1 font-mono text-xs">S3_BUCKET</code>,{' '}
        <code className="bg-muted rounded px-1 font-mono text-xs">S3_ACCESS_KEY_ID</code>… Giao diện
        không hiển thị và không cho sửa các giá trị bí mật này.
      </p>
      <div className={grid}>
        <Field label="Giữ file tạm (ngày)" htmlFor="st-retain">
          <Input id="st-retain" type="number" min={1} defaultValue={7} />
        </Field>
        <Field label="Dung lượng tối đa mỗi file (MB)" htmlFor="st-maxsize">
          <Input id="st-maxsize" type="number" min={1} defaultValue={10} />
        </Field>
      </div>
    </div>
  );
}

export function BatchSettings() {
  return (
    <div className="flex flex-col gap-4">
      <div className={grid}>
        <Field label="Luồng song song mặc định" htmlFor="st-conc" hint="Tối đa 8">
          <Input id="st-conc" type="number" min={1} max={8} defaultValue={2} />
        </Field>
        <Field label="Số lần thử lại khi lỗi" htmlFor="st-retry">
          <Input id="st-retry" type="number" min={0} max={10} defaultValue={3} />
        </Field>
        <Field label="Thời gian chờ giữa các lần thử (giây)" htmlFor="st-backoff">
          <Input id="st-backoff" type="number" min={1} defaultValue={5} />
        </Field>
        <Field label="Giới hạn video mỗi batch" htmlFor="st-maxbatch">
          <Input id="st-maxbatch" type="number" min={1} defaultValue={100} />
        </Field>
      </div>
      <SwitchRow label="Tạm dừng batch khi tỉ lệ lỗi > 30%" defaultChecked />
    </div>
  );
}

export function CostSettings() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed p-4">
        <p className="text-sm font-medium">Chi phí tháng này</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Chưa có dữ liệu – chưa tích hợp provider AI nào.
        </p>
      </div>
      <div className={grid}>
        <Field label="Ngân sách tháng (USD)" htmlFor="st-budget">
          <Input id="st-budget" type="number" min={0} step="1" defaultValue={50} />
        </Field>
        <Field label="Cảnh báo khi đạt (%)" htmlFor="st-alert">
          <Input id="st-alert" type="number" min={1} max={100} defaultValue={80} />
        </Field>
      </div>
      <SwitchRow
        label="Dừng tạo nội dung khi vượt ngân sách"
        hint="Ngăn phát sinh chi phí ngoài kế hoạch"
        defaultChecked
      />
    </div>
  );
}

export function TikTokSettings() {
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {TIKTOK_ACCOUNTS.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <span
              className="grid size-9 place-items-center rounded-full text-sm font-bold text-white"
              style={{ background: `oklch(0.55 0.13 ${a.hue})` }}
              aria-hidden
            >
              {a.displayName.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{a.displayName}</p>
              <p className="text-muted-foreground text-xs">{a.handle}</p>
            </div>
            <DemoBadge />
            <Badge variant="neutral">Chưa kết nối</Badge>
            <UnavailableButton size="sm" variant="ghost" reason="Cần OAuth TikTok – Phase 08">
              <Unplug /> Ngắt kết nối
            </UnavailableButton>
          </li>
        ))}
      </ul>
      <UnavailableButton
        reason="Kết nối TikTok cần OAuth phía server (client secret chỉ ở server) – dự kiến Phase 08"
        className="self-start"
      >
        <Link2 /> Kết nối tài khoản TikTok
      </UnavailableButton>
    </div>
  );
}
