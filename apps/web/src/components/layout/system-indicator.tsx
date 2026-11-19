'use client';

import { useEffect, useState } from 'react';
import { type HealthResponse, healthResponseSchema } from '@acs/shared';
import { Tooltip } from '@/components/ui/tooltip';
import { ApiError, apiRequest } from '@/lib/api/client';
import { cn } from '@/lib/utils';

type State =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

const LABEL = {
  ok: 'Hệ thống ổn định',
  degraded: 'Hoạt động một phần',
  down: 'Hệ thống gặp sự cố',
};

/**
 * Chỉ báo trạng thái hệ thống THẬT: gọi GET /health qua proxy /api/backend mỗi 30 giây.
 * (Đây là dữ liệu thật, không phải demo.)
 */
export function SystemIndicator() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // /health trả 503 kèm body hợp lệ khi down -> đọc lỗi rồi parse lại body
        const data = await apiRequest<HealthResponse>('/health', {
          schema: healthResponseSchema,
          timeoutMs: 8000,
        }).catch((error: unknown): null => {
          if (error instanceof ApiError && error.status === 503) return null;
          throw error;
        });
        if (!active) return;
        if (data) setState({ kind: 'ok', data });
        else setState({ kind: 'error', message: 'Một hoặc nhiều dịch vụ lõi đang down' });
      } catch (error) {
        if (active)
          setState({ kind: 'error', message: error instanceof Error ? error.message : 'Lỗi' });
      }
    };
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const status =
    state.kind === 'ok' ? state.data.status : state.kind === 'error' ? 'down' : undefined;
  const dot =
    status === 'ok'
      ? 'bg-success'
      : status === 'degraded'
        ? 'bg-warning'
        : status === 'down'
          ? 'bg-danger'
          : 'bg-neutral/50';
  const text = status ? LABEL[status] : 'Đang kiểm tra…';
  const detail =
    state.kind === 'ok'
      ? Object.entries(state.data.components)
          .map(([name, c]) => `${name}: ${c.status === 'up' ? 'sẵn sàng' : 'không khả dụng'}`)
          .join(' · ')
      : state.kind === 'error'
        ? state.message
        : 'Đang gọi /health';

  return (
    <Tooltip
      content={
        <span>
          Dữ liệu thật từ API /health
          <br />
          {detail}
        </span>
      }
      side="bottom"
    >
      <span
        tabIndex={0}
        role="status"
        className="bg-card hidden items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:inline-flex"
      >
        <span
          className={cn(
            'size-2 rounded-full',
            dot,
            status === 'ok' && 'shadow-[0_0_0_3px] shadow-success/20',
          )}
        />
        {text}
      </span>
    </Tooltip>
  );
}
