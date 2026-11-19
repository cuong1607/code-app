'use client';

import { CalendarClock } from 'lucide-react';
import { DemoBadge, DemoNotice } from '@/components/common';
import { PublishConfigPanel } from './publish-config-panel';
import { PublishTable } from './publish-table';
import { usePublishing } from './use-publishing';

/** LỊCH ĐĂNG TIKTOK: panel cấu hình (trái) | bảng lịch đăng (phải). */
export function PublishingView() {
  const state = usePublishing();
  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 lg:h-[calc(100dvh-var(--topbar-height))] lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="bg-sidebar text-sidebar-primary grid size-9 place-items-center rounded-lg">
            <CalendarClock className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl leading-tight font-semibold tracking-tight">Lịch đăng TikTok</h1>
            <p className="text-muted-foreground text-xs">
              Lên lịch, kiểm duyệt và theo dõi bài đăng
            </p>
          </div>
        </div>
        <DemoBadge />
        <DemoNotice className="w-full py-2 text-xs lg:ml-auto lg:w-auto lg:max-w-[52rem]">
          Chưa kết nối TikTok: tài khoản và bài đăng là <strong>DEMO</strong>. &quot;Tạo lịch
          đăng&quot; chỉ tạo
          <strong> bài nháp trên trình duyệt</strong>, không có bài nào được đăng thật.
        </DemoNotice>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(300px,25%)_minmax(0,1fr)]">
        <aside
          aria-label="Cấu hình lịch đăng"
          className="scrollbar-thin flex min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-2"
        >
          <PublishConfigPanel state={state} />
        </aside>
        <PublishTable state={state} />
      </div>
    </div>
  );
}
