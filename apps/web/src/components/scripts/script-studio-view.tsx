'use client';

import { FileText } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { DemoNotice, PageHeader, SectionCard } from '@/components/common';
import { NativeSelect } from '@/components/ui/native-select';
import { formatDateTime } from '@/lib/format';
import { SCRIPT_ORIGIN_LABEL } from '@/lib/labels';
import { ScriptConfigPanel } from './script-config-panel';
import { ScriptWorkspace } from './script-workspace';
import { useScriptStudio } from './use-script-studio';

/**
 * AI SCRIPT STUDIO (Phase 03)
 * Trái: chọn sản phẩm thật + cấu hình + provider. Phải: kết quả, phân cảnh, lời thoại, caption, lịch sử phiên bản.
 */
export function ScriptStudioView() {
  const params = useSearchParams();
  const s = useScriptStudio(params.get('script'));
  const noProvider =
    s.providers.data && !s.providers.data.providers.some((p) => p.status === 'ready' && !p.isMock);

  return (
    <>
      <PageHeader
        title="Kịch bản AI"
        icon={FileText}
        description="AI viết kịch bản video bán hàng tiếng Việt từ dữ liệu sản phẩm thật: hook, phân cảnh, lời thoại, caption, hashtag và CTA."
      />
      {noProvider ? (
        <DemoNotice tone="info">
          Chưa có nhà cung cấp AI thật nào được cấu hình ở server. Đặt{' '}
          <code>ANTHROPIC_API_KEY</code> (hoặc <code>OPENAI_API_KEY</code> +{' '}
          <code>OPENAI_SCRIPT_MODEL</code>) trong file <code>.env</code> rồi khởi động lại API.
          {s.providers.data?.providers.some((p) => p.isMock && p.status === 'ready')
            ? ' Hiện chỉ có Mock provider (nội dung có nhãn MOCK – không phải AI) để kiểm thử.'
            : ''}
        </DemoNotice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <ScriptConfigPanel s={s} />
          <SectionCard title="Kịch bản đã lưu" icon={FileText}>
            <NativeSelect
              aria-label="Mở kịch bản đã lưu"
              value=""
              onChange={(e) =>
                e.target.value && void s.openScript(e.target.value, { loadGroup: true })
              }
              placeholder={
                s.saved.loading && !s.saved.data
                  ? 'Đang tải…'
                  : s.saved.data?.length
                    ? 'Mở kịch bản đã lưu…'
                    : 'Chưa có kịch bản đã lưu'
              }
              options={(s.saved.data ?? []).map((d) => ({
                value: d.id,
                label: `${d.title} · v${d.versionNumber} · ${d.isMock ? 'MOCK' : SCRIPT_ORIGIN_LABEL[d.origin]} · ${formatDateTime(d.updatedAt)}`,
              }))}
            />
            {s.saved.error ? <p className="text-danger text-xs">{s.saved.error}</p> : null}
          </SectionCard>
        </div>

        <section
          aria-label="Kết quả kịch bản"
          className="bg-card min-w-0 rounded-xl border p-4 shadow-xs sm:p-5"
        >
          <ScriptWorkspace s={s} />
        </section>
      </div>
    </>
  );
}
