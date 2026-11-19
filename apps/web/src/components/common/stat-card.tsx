import type { Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { DemoBadge } from './demo';

const ICON_TONE: Record<Tone | 'primary', string> = {
  primary: 'bg-primary/15 text-[oklch(0.5_0.12_62)]',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/18 text-[oklch(0.5_0.12_62)]',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  processing: 'bg-processing/12 text-processing',
  neutral: 'bg-neutral/12 text-neutral',
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  hint?: React.ReactNode;
  tone?: Tone | 'primary';
  isDemo?: boolean;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'primary',
  isDemo,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-card group flex flex-col gap-3 rounded-xl border p-4 shadow-xs transition-shadow hover:shadow-md',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', ICON_TONE[tone])}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        {isDemo ? <DemoBadge /> : null}
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </div>
    </div>
  );
}
