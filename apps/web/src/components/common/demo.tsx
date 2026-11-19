import { FlaskConical, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Nhãn DEMO gắn lên mọi dữ liệu không thật. */
export function DemoBadge({ className, label = 'DEMO' }: { className?: string; label?: string }) {
  return (
    <Badge variant="demo" className={className} title="Dữ liệu mẫu – không phải dữ liệu thật">
      <FlaskConical aria-hidden />
      {label}
    </Badge>
  );
}

/** Thanh thông báo giải thích phạm vi dữ liệu / chức năng của trang. */
export function DemoNotice({
  children,
  className,
  tone = 'demo',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'demo' | 'info';
}) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm',
        tone === 'demo'
          ? 'border-primary/40 bg-primary/8 border-dashed text-[oklch(0.38_0.06_60)]'
          : 'border-info/25 bg-info/6 text-[oklch(0.38_0.08_245)]',
        className,
      )}
    >
      {tone === 'demo' ? (
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 leading-relaxed">{children}</div>
    </div>
  );
}
