'use client';

import { FileText, FlaskConical, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { VIDEO_DURATIONS } from '@acs/shared';
import {
  DemoNotice,
  EmptyState,
  Field,
  OptionChips,
  PageHeader,
  PromptEditor,
  SectionCard,
  UnavailableButton,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useAsync } from '@/hooks/use-async';
import {
  AUDIENCES,
  SCRIPT_STYLES,
  SCRIPT_TONES,
  productRepository,
  scriptRepository,
} from '@/lib/data';
import { describeError } from '@/lib/api/client';
import type { GeneratedScript } from '@/types/domain';
import { ScriptResult } from './script-result';

export function ScriptStudioView() {
  const products = useAsync(() => productRepository.options(), []);
  const [productId, setProductId] = useState('');
  const [style, setStyle] = useState<string>(SCRIPT_STYLES[0].id);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [audience, setAudience] = useState<string>(AUDIENCES[0].id);
  const [tone, setTone] = useState<string>(SCRIPT_TONES[0].id);
  const [variants, setVariants] = useState(3);
  const [script, setScript] = useState<GeneratedScript>();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const product = products.data?.find((p) => p.id === productId);

  const loadDemo = async () => {
    setLoadingDemo(true);
    try {
      setScript(await scriptRepository.demoScript(product?.name ?? 'Sản phẩm mẫu', duration));
      toast.info('Đã nạp kịch bản MẪU', {
        description: 'Đây là nội dung cố định để xem bố cục, không do AI tạo.',
      });
    } catch (error) {
      toast.error('Không nạp được kịch bản mẫu', { description: describeError(error) });
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Kịch bản AI"
        icon={FileText}
        description="AI viết kịch bản video bán hàng: hook, lời thoại, phân cảnh, caption và hashtag."
      />
      <DemoNotice tone="info">
        Chưa có AI script provider (dự kiến <strong>Phase 03</strong>). Bạn có thể cấu hình và xem
        <strong> kịch bản mẫu</strong> để duyệt bố cục; nút tạo kịch bản sẽ hoạt động khi provider
        được tích hợp.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard step={1} title="Sản phẩm & phong cách">
            <Field label="Sản phẩm" htmlFor="sc-product">
              <NativeSelect
                id="sc-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={products.loading ? 'Đang tải…' : 'Chọn sản phẩm (DEMO)'}
                options={(products.data ?? []).map((p) => ({
                  value: p.id,
                  label: `${p.name} · ${p.sku}`,
                }))}
              />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Phong cách kịch bản</span>
              <OptionChips
                label="Phong cách kịch bản"
                size="sm"
                value={style}
                onChange={setStyle}
                options={SCRIPT_STYLES.map((s) => ({ value: s.id, label: s.name }))}
              />
            </div>
          </SectionCard>

          <SectionCard step={2} title="Yêu cầu chi tiết">
            <PromptEditor
              label="Prompt tuỳ chỉnh"
              value={prompt}
              onChange={setPrompt}
              rows={4}
              maxLength={1000}
              placeholder="VD: Nhấn mạnh chất liệu cotton thoáng mát, có ưu đãi freeship…"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Thời lượng mục tiêu</span>
              <OptionChips
                label="Thời lượng mục tiêu"
                value={duration}
                onChange={setDuration}
                options={VIDEO_DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Đối tượng khách hàng" htmlFor="sc-audience">
                <NativeSelect
                  id="sc-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  options={AUDIENCES.map((a) => ({ value: a.id, label: a.name }))}
                />
              </Field>
              <Field label="Giọng văn" htmlFor="sc-tone">
                <NativeSelect
                  id="sc-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  options={SCRIPT_TONES.map((t) => ({ value: t.id, label: t.name }))}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Số lượng biến thể</span>
              <OptionChips
                label="Số lượng biến thể"
                value={variants}
                onChange={setVariants}
                options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
              />
            </div>
          </SectionCard>

          <div className="bg-card flex flex-col gap-2 rounded-xl border p-3.5 shadow-xs">
            <UnavailableButton reason="Cần AI script provider phía server – dự kiến Phase 03">
              <Sparkles /> Tạo {variants} kịch bản
            </UnavailableButton>
            <Button variant="outline" onClick={loadDemo} disabled={loadingDemo}>
              <FlaskConical /> Xem kịch bản mẫu (DEMO)
            </Button>
          </div>
        </div>

        <section
          aria-label="Kết quả kịch bản"
          className="bg-card min-w-0 rounded-xl border p-4 shadow-xs sm:p-5"
        >
          {script ? (
            <ScriptResult script={script} onChange={setScript} />
          ) : (
            <EmptyState
              icon={Wand2}
              className="py-20"
              title="Chưa có kịch bản"
              description='Cấu hình ở bên trái. Hiện chưa có AI – bấm "Xem kịch bản mẫu" để xem bố cục kết quả.'
              action={
                <Button variant="outline" size="sm" onClick={loadDemo}>
                  <FlaskConical /> Xem kịch bản mẫu
                </Button>
              }
            />
          )}
        </section>
      </div>
    </>
  );
}
