import {
  CalendarClock,
  Clapperboard,
  FileText,
  FolderOpen,
  ImageIcon,
  LayoutDashboard,
  Package,
  Settings,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Tổng quan',
    icon: LayoutDashboard,
    description: 'Số liệu và hoạt động',
  },
  { href: '/products', label: 'Sản phẩm', icon: Package, description: 'Quản lý sản phẩm & ảnh' },
  {
    href: '/studio/scripts',
    label: 'Kịch bản AI',
    icon: FileText,
    description: 'AI viết kịch bản',
  },
  {
    href: '/studio/images',
    label: 'Xưởng ảnh AI',
    icon: ImageIcon,
    description: 'Tạo ảnh sản phẩm',
  },
  {
    href: '/studio/videos',
    label: 'Xưởng video',
    icon: Clapperboard,
    description: 'Sản xuất video hàng loạt',
  },
  { href: '/library', label: 'Thư viện', icon: FolderOpen, description: 'Tài nguyên media' },
  {
    href: '/publishing',
    label: 'Lịch đăng TikTok',
    icon: CalendarClock,
    description: 'Lên lịch đăng bài',
  },
  { href: '/settings', label: 'Cài đặt', icon: Settings, description: 'Cấu hình hệ thống' },
];

/** Mục menu ứng với pathname hiện tại (khớp tiền tố dài nhất). */
export function findActiveNav(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
