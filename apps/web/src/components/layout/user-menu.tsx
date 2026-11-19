'use client';

import { ChevronDown, CircleUser, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DEMO_USER } from '@/lib/data';

export function UserMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="hover:bg-accent focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 rounded-lg p-1 pr-2 outline-none focus-visible:ring-[3px]"
        aria-label="Menu tài khoản"
      >
        <span className="bg-sidebar text-sidebar-primary grid size-8 place-items-center rounded-full text-xs font-bold">
          {DEMO_USER.initials}
        </span>
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-medium">{DEMO_USER.name}</span>
          <span className="text-muted-foreground block text-[11px]">{DEMO_USER.role}</span>
        </span>
        <ChevronDown className="text-muted-foreground hidden size-4 md:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{DEMO_USER.name}</p>
          <p className="text-muted-foreground text-xs">{DEMO_USER.email}</p>
          <p className="mt-1.5 inline-block rounded border border-dashed border-primary/60 px-1 text-[10px] font-semibold">
            TÀI KHOẢN DEMO
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
          <LogOut /> Đăng xuất
          <span className="text-muted-foreground ml-auto text-[10px]">Phase 09</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
