import { ArrowRight, Clapperboard, Factory, FileText, PackagePlus } from 'lucide-react';
import Link from 'next/link';

const ACTIONS = [
  {
    href: '/products?action=new',
    label: 'Thêm sản phẩm',
    desc: 'Nhập thông tin & ảnh',
    icon: PackagePlus,
  },
  { href: '/studio/scripts', label: 'Tạo kịch bản', desc: 'AI viết lời thoại', icon: FileText },
  { href: '/studio/videos', label: 'Tạo video', desc: 'Cấu hình một video', icon: Clapperboard },
  {
    href: '/studio/videos#batch',
    label: 'Mở Video Factory',
    desc: 'Sản xuất hàng loạt',
    icon: Factory,
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {ACTIONS.map(({ href, label, desc, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="group bg-card hover:border-primary/60 focus-visible:ring-ring/40 flex items-center gap-3 rounded-xl border p-3 transition-all outline-none hover:-translate-y-px hover:shadow-md focus-visible:ring-[3px]"
        >
          <span className="bg-sidebar text-sidebar-primary grid size-10 shrink-0 place-items-center rounded-lg">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{label}</span>
            <span className="text-muted-foreground block truncate text-xs">{desc}</span>
          </span>
          <ArrowRight
            className="text-muted-foreground group-hover:text-foreground size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}
