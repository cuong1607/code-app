'use client';

import { FilePlus2, FileText, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { type ScriptContent, type ScriptDraft, VIDEO_DURATIONS } from '@acs/shared';
import {
  ConfirmDialog,
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
import { describeError } from '@/lib/api/client';
import {
  AUDIENCES,
  SCRIPT_STYLES,
  SCRIPT_TONES,
  productRepository,
  scriptDraftRepository,
} from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { buildSampleScript } from '@/lib/sample-script';
import { ScriptResult } from './script-result';

export function ScriptStudioView() {
  const products = useAsync(() => productRepository.options(), []);
  const drafts = useAsync(() => scriptDraftRepository.list(), []);
  const [productId, setProductId] = useState('');
  const [style, setStyle] = useState<string>(SCRIPT_STYLES[0].id);
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<number>(30);
  const [audience, setAudience] = useState<string>(AUDIENCES[0].id);
  const [tone, setTone] = useState<string>(SCRIPT_TONES[0].id);
  const [variants, setVariants] = useState(3);
  const [script, setScript] = useState<ScriptContent>();
  const [fromSample, setFromSample] = useState(false);
  const [draft, setDraft] = useState<ScriptDraft>();
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const product = products.data?.find((p) => p.id === productId);

  const startFromSample = () => {
    setScript(buildSampleScript(product?.name ?? 'Sản phẩm', duration));
    setFromSample(true);
    setDraft(undefined);
    toast.info('Đã nạp khuôn kịch bản mẫu', {
      description: 'Nội dung cố định để bạn chỉnh sửa – không do AI tạo.',
    });
  };

  const loadDraft = (id: string) => {
    const d = drafts.data?.find((x) => x.id === id);
    if (!d) return;
    setDraft(d);
    setScript(d.content);
    setFromSample(false);
    setProductId(d.productId ?? '');
    if (typeof d.config.style === 'string') setStyle(d.config.style);
    if (typeof d.config.tone === 'string') setTone(d.config.tone);
    if (typeof d.config.audience === 'string') setAudience(d.config.audience);
    if (typeof d.config.duration === 'number') setDuration(d.config.duration);
    if (typeof d.config.prompt === 'string') setPrompt(d.config.prompt);
  };

  const save = async () => {
    if (!script) return;
    setSaving(true);
    const input = {
      productId: productId || null,
      content: script,
      config: { style, tone, audience, duration, variants, prompt },
    };
    try {
      const saved = draft
        ? await scriptDraftRepository.update(draft.id, input)
        : await scriptDraftRepository.create(input);
      setDraft(saved);
      drafts.reload();
      toast.success(draft ? 'Đã cập nhật kịch bản nháp' : 'Đã lưu kịch bản nháp vào database');
    } catch (error) {
      toast.error('Không lưu được kịch bản', { description: describeError(error) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft) return;
    try {
      await scriptDraftRepository.remove(draft.id);
      toast.success('Đã xoá kịch bản nháp');
      setDraft(undefined);
      setScript(undefined);
      drafts.reload();
    } catch (error) {
      toast.error('Không xoá được', { description: describeError(error) });
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
        Chưa có AI script provider (dự kiến <strong>Phase 03</strong>). Hiện bạn có thể bắt đầu từ
        <strong> khuôn kịch bản mẫu</strong>, chỉnh sửa và <strong>lưu nháp vào database</strong>.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard step={1} title="Sản phẩm & phong cách">
            <Field label="Sản phẩm" htmlFor="sc-product">
              <NativeSelect
                id="sc-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={
                  products.loading
                    ? 'Đang tải…'
                    : products.data?.length
                      ? 'Chọn sản phẩm'
                      : 'Chưa có sản phẩm'
                }
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
              <Sparkles /> Tạo {variants} kịch bản bằng AI
            </UnavailableButton>
            <Button variant="outline" onClick={startFromSample}>
              <FilePlus2 /> Bắt đầu từ khuôn mẫu
            </Button>
          </div>

          <SectionCard title="Kịch bản đã lưu" icon={FileText}>
            <div className="flex gap-1.5">
              <NativeSelect
                aria-label="Chọn kịch bản đã lưu"
                className="min-w-0 flex-1"
                value={draft?.id ?? ''}
                onChange={(e) => loadDraft(e.target.value)}
                placeholder={
                  drafts.loading
                    ? 'Đang tải…'
                    : drafts.data?.length
                      ? 'Mở kịch bản đã lưu…'
                      : 'Chưa có kịch bản đã lưu'
                }
                options={(drafts.data ?? []).map((d) => ({
                  value: d.id,
                  label: `${d.content.title} · ${formatDateTime(d.updatedAt)}`,
                }))}
              />
              <Button
                size="icon"
                variant="outline"
                aria-label="Xoá kịch bản đang mở"
                disabled={!draft}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
              </Button>
            </div>
          </SectionCard>
        </div>

        <section
          aria-label="Kết quả kịch bản"
          className="bg-card min-w-0 rounded-xl border p-4 shadow-xs sm:p-5"
        >
          {script ? (
            <ScriptResult
              script={script}
              onChange={setScript}
              fromSample={fromSample}
              saving={saving}
              savedAt={draft?.updatedAt}
              onSave={() => void save()}
            />
          ) : (
            <EmptyState
              icon={Wand2}
              className="py-20"
              title="Chưa có kịch bản"
              description="Chưa có AI – bắt đầu từ khuôn mẫu để chỉnh sửa, hoặc mở một kịch bản đã lưu."
              action={
                <Button variant="outline" size="sm" onClick={startFromSample}>
                  <FilePlus2 /> Bắt đầu từ khuôn mẫu
                </Button>
              }
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Xoá kịch bản nháp?"
        description="Kịch bản sẽ bị xoá khỏi database."
        confirmLabel="Xoá"
        onConfirm={() => void remove()}
      />
    </>
  );
}
