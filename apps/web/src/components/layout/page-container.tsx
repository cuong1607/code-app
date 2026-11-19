import { cn } from '@/lib/utils';

/** Vùng nội dung chuẩn của mỗi trang (padding + độ rộng tối đa). */
export function PageContainer({
  children,
  className,
  fluid = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** true: dùng toàn chiều ngang (VD: Video Factory) */
  fluid?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col gap-5 p-4 sm:p-6',
        fluid ? 'max-w-none' : 'max-w-[1440px]',
        className,
      )}
    >
      {children}
    </div>
  );
}
