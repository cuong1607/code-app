'use client';

import { Clapperboard } from 'lucide-react';
import { DemoBadge, DemoNotice } from '@/components/common';
import { BatchSection } from './batch-section';
import { ConfigSection } from './config-section';
import { FactoryTable } from './factory-table';
import { ProductsSection } from './products-section';
import { PromptSection } from './prompt-section';
import { useVideoFactory } from './use-video-factory';

/**
 * XƯỞNG VIDEO (Video Factory)
 * Bố cục: panel cấu hình ~25% (cuộn độc lập) | bảng tác vụ ~75%.
 */
export function VideoFactoryView() {
  const state = useVideoFactory();
  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 lg:h-[calc(100dvh-var(--topbar-height))] lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="bg-sidebar text-sidebar-primary grid size-9 place-items-center rounded-lg">
            <Clapperboard className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl leading-tight font-semibold tracking-tight">Xưởng video</h1>
            <p className="text-muted-foreground text-xs">Sản xuất video sản phẩm hàng loạt</p>
          </div>
        </div>
        <DemoBadge />
        <DemoNotice className="w-full py-2 text-xs lg:ml-auto lg:w-auto lg:max-w-[52rem]">
          Bảng hiển thị tác vụ <strong>DEMO</strong> (không có video thật). &quot;Tạo luồng sản
          xuất&quot; chỉ tạo
          <strong> luồng nháp trên trình duyệt</strong>; chạy/tạm dừng/dừng cần backend ở Phase 07.
        </DemoNotice>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(300px,25%)_minmax(0,1fr)]">
        <aside
          aria-label="Cấu hình sản xuất"
          className="scrollbar-thin flex min-w-0 flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-2"
        >
          <PromptSection state={state} />
          <ConfigSection state={state} />
          <ProductsSection state={state} />
          <BatchSection state={state} />
        </aside>
        <FactoryTable state={state} />
      </div>
    </div>
  );
}
