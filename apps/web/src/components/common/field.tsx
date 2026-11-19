import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Nhãn + control + gợi ý/lỗi cho form. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  badge,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="text-danger" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {badge}
      </div>
      {children}
      {error ? (
        <p className="text-danger text-xs" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
