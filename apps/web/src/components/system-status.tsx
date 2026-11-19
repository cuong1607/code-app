import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Database,
  HardDrive,
  Layers,
  Server,
} from 'lucide-react';
import {
  type ComponentHealth,
  DEFAULT_DISPLAY_TIMEZONE,
  type HealthComponentName,
  type OverallStatus,
  formatDisplayDateTime,
} from '@acs/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ApiHealthResult } from '@/lib/api-health';

const COMPONENT_LABELS: Record<HealthComponentName, { label: string; icon: React.ElementType }> = {
  database: { label: 'PostgreSQL', icon: Database },
  redis: { label: 'Redis / Hàng đợi', icon: Layers },
  storage: { label: 'MinIO (lưu trữ)', icon: HardDrive },
  worker: { label: 'Worker', icon: Server },
};

const OVERALL: Record<
  OverallStatus,
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  ok: { label: 'Hoạt động tốt', variant: 'success' },
  degraded: { label: 'Hoạt động một phần', variant: 'warning' },
  down: { label: 'Gặp sự cố', variant: 'destructive' },
};

function ComponentRow({ name, health }: { name: HealthComponentName; health: ComponentHealth }) {
  const { label, icon: Icon } = COMPONENT_LABELS[name];
  const up = health.status === 'up';
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <Icon className="text-muted-foreground mt-0.5 size-4" aria-hidden />
        <div>
          <p className="text-sm font-medium">{label}</p>
          {health.message ? (
            <p className="text-muted-foreground mt-0.5 text-xs break-all">{health.message}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {health.latencyMs !== undefined ? (
          <span className="text-muted-foreground text-xs tabular-nums">{health.latencyMs} ms</span>
        ) : null}
        <Badge variant={up ? 'success' : 'destructive'}>
          {up ? <CircleCheck /> : <CircleX />}
          {up ? 'Sẵn sàng' : 'Không khả dụng'}
        </Badge>
      </div>
    </li>
  );
}

export function SystemStatus({ result }: { result: ApiHealthResult }) {
  if (!result.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleAlert className="text-destructive size-5" /> Không kết nối được API
          </CardTitle>
          <CardDescription>
            Web không gọi được <code className="font-mono">{result.apiUrl}/health</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-destructive break-all">{result.error}</p>
          <p className="text-muted-foreground">
            Hãy chạy <code className="font-mono">pnpm infra:up</code> và{' '}
            <code className="font-mono">pnpm dev:api</code>, sau đó tải lại trang.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { data } = result;
  const overall = OVERALL[data.status];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Trạng thái hệ thống</CardTitle>
          <Badge variant={overall.variant}>{overall.label}</Badge>
        </div>
        <CardDescription>
          Kiểm tra lúc {formatDisplayDateTime(data.timestamp, { withSeconds: true })} (
          {DEFAULT_DISPLAY_TIMEZONE}) · API v{data.version}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {(Object.keys(COMPONENT_LABELS) as HealthComponentName[]).map((name) => (
            <ComponentRow key={name} name={name} health={data.components[name]} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
