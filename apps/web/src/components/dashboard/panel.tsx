import { cn } from '@/lib/utils';

/** Khung có tiêu đề dùng cho các khối trên dashboard. */
export function Panel({
  title,
  description,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('bg-card flex min-w-0 flex-col rounded-xl border shadow-xs', className)}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      <div className={cn('min-w-0 flex-1 px-4 pb-4 sm:px-5', bodyClassName)}>{children}</div>
    </section>
  );
}
