import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-muted-foreground text-sm">Đường dẫn bạn truy cập không tồn tại.</p>
      <Button asChild variant="outline">
        <Link href="/">Về trang chủ</Link>
      </Button>
    </main>
  );
}
