import { Skeleton } from '@/components/ui/misc';

/** Skeleton hiển thị khi chuyển trang (Next.js streaming). */
export default function Loading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Đang tải trang…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
