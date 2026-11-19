import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ElementType;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  badges,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {Icon ? (
            <span className="bg-primary/15 text-[oklch(0.5_0.12_62)] grid size-9 place-items-center rounded-lg">
              <Icon className="size-5" aria-hidden />
            </span>
          ) : null}
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badges}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-1.5 max-w-3xl text-sm leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
