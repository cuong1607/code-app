'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <CircleAlert className="text-destructive size-10" aria-hidden />
      <h1 className="text-xl font-semibold">Đã xảy ra lỗi</h1>
      <p className="text-muted-foreground text-sm">
        Trang không tải được. Vui lòng thử lại.
        {error.digest ? (
          <>
            {' '}
            Mã lỗi: <code className="font-mono">{error.digest}</code>
          </>
        ) : null}
      </p>
      <Button onClick={reset}>Thử lại</Button>
    </main>
  );
}
