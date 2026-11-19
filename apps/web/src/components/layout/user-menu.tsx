'use client';

import { ChevronDown, CircleUser, LogIn, Settings } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Chưa có xác thực (Phase 09): hiển thị trung thực trạng thái "chế độ phát triển". */
export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg p-1 pr-2 outline-none focus-visible:ring-[3px]"
        aria-label="Menu tài khoản"
      >
        <span className="bg-sidebar text-sidebar-primary grid size-8 place-items-center rounded-full">
          <CircleUser className="size-4" aria-hidden />
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-medium">Chế độ phát triển</span>
          <span className="text-muted-foreground block text-[11px]">Chưa đăng nhập</span>
        </span>
        <ChevronDown className="text-muted-foreground hidden size-4 md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">Chế độ phát triển (dev-local)</p>
          <p className="text-muted-foreground mt-1 text-xs leading-snug">
            Chưa có hệ thống đăng nhập. API chỉ chấp nhận truy cập từ máy cục bộ.
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=account">
            <CircleUser /> Thông tin tài khoản
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings /> Cài đặt
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogIn /> Đăng nhập
          <span className="text-muted-foreground ml-auto text-[10px]">Phase 09</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
