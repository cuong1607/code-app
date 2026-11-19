import { CircleAlert, Inbox, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ElementType;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="bg-muted text-muted-foreground grid size-12 place-items-center rounded-full">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="max-w-sm">
        <p className="font-medium">{title}</p>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'Không tải được dữ liệu',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}
    >
      <span className="bg-danger/10 text-danger grid size-12 place-items-center rounded-full">
        <CircleAlert className="size-6" aria-hidden />
      </span>
      <div className="max-w-md">
        <p className="font-medium">{title}</p>
        {message ? (
          <p className="text-muted-foreground mt-1 text-sm break-words">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Thử lại
        </Button>
      ) : null}
    </div>
  );
}

/** Skeleton tải dữ liệu: dạng bảng, lưới thẻ hoặc khối. */
export function LoadingState({
  variant = 'table',
  rows = 6,
  className,
  label = 'Đang tải dữ liệu…',
}: {
  variant?: 'table' | 'grid' | 'block';
  rows?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn('w-full', className)}>
      <span className="sr-only">{label}</span>
      {variant === 'table' ? (
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-4" />
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : variant === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
    </div>
  );
}
