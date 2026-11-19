'use client';

import { CirclePause, CirclePlay, CircleStop, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import { SectionCard, UnavailableButton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/format';
import type { VideoFactoryState } from './use-video-factory';

const NEED_BACKEND = 'Cần backend hàng đợi sản xuất (BullMQ worker) – dự kiến Phase 07';

/** Khu vực 4: Tạo batch. */
export function BatchSection({ state }: { state: VideoFactoryState }) {
  const { selected, config, totalVideos, createDrafts, creating } = state;
  const promptEmpty = !config.prompt.trim();
  const disabledReason =
    selected.length === 0
      ? 'Hãy chọn ít nhất 1 sản phẩm'
      : promptEmpty
        ? 'Prompt không được để trống'
        : undefined;

  return (
    <SectionCard step={4} title="Tạo batch">
      <div id="batch" className="grid scroll-mt-24 grid-cols-3 gap-2 text-center">
        {[
          { label: 'Sản phẩm', value: selected.length },
          { label: 'Phiên bản', value: config.versionsPerProduct },
          { label: 'Tổng video', value: totalVideos, highlight: true },
        ].map((item) => (
          <div
            key={item.label}
            className={
              item.highlight
                ? 'bg-sidebar text-sidebar-foreground rounded-lg p-2'
                : 'bg-muted rounded-lg p-2'
            }
          >
            <p
              className={
                item.highlight
                  ? 'text-sidebar-muted text-[11px]'
                  : 'text-muted-foreground text-[11px]'
              }
            >
              {item.label}
            </p>
            <p
              className={
                item.highlight
                  ? 'text-sidebar-primary tabular text-xl font-bold'
                  : 'tabular text-xl font-bold'
              }
            >
              {formatNumber(item.value)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Ước tính thời lượng: {formatNumber(totalVideos * config.durationSec)} giây video ·{' '}
        {config.concurrency} luồng song song.
      </p>

      <Button
        disabled={Boolean(disabledReason) || creating}
        title={disabledReason}
        onClick={async () => {
          try {
            const count = await createDrafts();
            toast.success(`Đã lưu ${count} luồng sản xuất nháp`, {
              description:
                'Đã lưu vào database ở trạng thái "Chờ xử lý". Render video sẽ có ở Phase 06/07.',
            });
          } catch (error) {
            toast.error('Không tạo được luồng sản xuất', { description: (error as Error).message });
          }
        }}
      >
        <Workflow /> {creating ? 'Đang lưu…' : 'Tạo luồng sản xuất'}
      </Button>
      {disabledReason ? (
        <p className="text-muted-foreground -mt-1.5 text-xs">{disabledReason}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        <UnavailableButton size="sm" variant="dark" reason={NEED_BACKEND} showLock={false}>
          <CirclePlay /> Chạy tất cả
        </UnavailableButton>
        <UnavailableButton size="sm" variant="outline" reason={NEED_BACKEND} showLock={false}>
          <CirclePause /> Tạm dừng
        </UnavailableButton>
        <UnavailableButton size="sm" variant="outline" reason={NEED_BACKEND} showLock={false}>
          <CircleStop /> Dừng
        </UnavailableButton>
      </div>
      <p className="text-muted-foreground text-center text-[11px]">
        Chạy/tạm dừng/dừng sẽ hoạt động khi có backend (Phase 07).
      </p>
    </SectionCard>
  );
}
