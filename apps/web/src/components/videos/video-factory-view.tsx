'use client';

import { Clapperboard, FileText, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DemoNotice } from '@/components/common';
import { Button } from '@/components/ui/button';
import { BatchSection } from './batch-section';
import { ConfigSection } from './config-section';
import { FactoryTable } from './factory-table';
import { ProductsSection } from './products-section';
import { PromptSection } from './prompt-section';
import { useVideoFactory } from './use-video-factory';

/**
 * XƯỞNG VIDEO (Video Factory)
 * Bố cục: panel cấu hình ~25% (cuộn độc lập) | bảng tác vụ ~75%.
 * Phase 02: luồng sản xuất được LƯU DATABASE dưới dạng nháp; render ở Phase 06/07.
 */
export function VideoFactoryView() {
  const params = useSearchParams();
  const initial = (params.get('products') ?? '').split(',').filter(Boolean);
  const state = useVideoFactory(initial, params.get('script'));
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
        <DemoNotice
          tone="info"
          className="w-full py-2 text-xs lg:ml-auto lg:w-auto lg:max-w-[52rem]"
        >
          &quot;Tạo luồng sản xuất&quot; <strong>lưu luồng nháp vào database</strong> (trạng thái
          Chờ xử lý). Chưa có worker render: chạy/tạm dừng/dừng sẽ hoạt động ở Phase 07.
        </DemoNotice>
      </div>
      {state.script || state.scriptError ? (
        <div
          role="status"
          className="bg-card flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <FileText className="text-primary size-4" aria-hidden />
          {state.script ? (
            <span className="min-w-0">
              Kịch bản đầu vào: <strong>{state.script.title}</strong> (phiên bản{' '}
              {state.script.versionNumber}
              {state.script.productName ? ` · ${state.script.productName}` : ''}) – được gắn vào
              luồng của đúng sản phẩm này.
            </span>
          ) : (
            <span className="text-danger">Không tải được kịch bản: {state.scriptError}</span>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={state.clearScript}>
            <X /> Bỏ kịch bản
          </Button>
        </div>
      ) : null}

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
