'use client';

import { Check, Download, FlaskConical, FolderPlus, ImageIcon, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import {
  DemoBadge,
  DemoNotice,
  EmptyState,
  Field,
  FileUpload,
  MediaPreview,
  OptionChips,
  PageHeader,
  PromptEditor,
  SectionCard,
  UnavailableButton,
  UnavailableChip,
} from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { useAsync } from '@/hooks/use-async';
import { useSelection } from '@/hooks/use-selection';
import { AI_PROVIDER_PLACEHOLDERS, IMAGE_TEMPLATES, productRepository } from '@/lib/data';
import type { ImageRef } from '@/types/domain';
import { cn } from '@/lib/utils';
import { ImageViewerDialog } from './image-viewer-dialog';

const ASPECTS = ['1:1', '4:5', '9:16', '16:9'] as const;
type ImageAspect = (typeof ASPECTS)[number];
const COUNTS = [1, 2, 4, 6, 8];

export function ImageStudioView() {
  const products = useAsync(() => productRepository.options(), []);
  const [productId, setProductId] = useState('');
  const [references, setReferences] = useState<ImageRef[]>([]);
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState<string>(IMAGE_TEMPLATES[0].id);
  const [aspect, setAspect] = useState<ImageAspect>('1:1');
  const [count, setCount] = useState(4);
  const [results, setResults] = useState<ImageRef[]>([]);
  const [viewing, setViewing] = useState<ImageRef>();
  const selection = useSelection();

  const product = products.data?.find((p) => p.id === productId);
  const original = references[0] ?? product?.images[0];
  const template = IMAGE_TEMPLATES.find((t) => t.id === templateId)!;

  const showDemoLayout = () => {
    selection.clear();
    setResults(
      Array.from({ length: count }, (_, i) => ({
        id: `demo-gen-${templateId}-${aspect}-${i}`,
        hue: ((product?.images[0]?.hue ?? 30) + i * 45) % 360,
        label: `Khung mẫu ${i + 1} · ${template.name}`,
      })),
    );
  };

  return (
    <>
      <PageHeader
        title="Xưởng ảnh AI"
        icon={ImageIcon}
        description="Tạo ảnh quảng cáo, lifestyle, người mẫu… từ ảnh sản phẩm."
      />
      <DemoNotice tone="info">
        Chưa tích hợp image provider (dự kiến <strong>Phase 04</strong>) – trang này{' '}
        <strong>không gọi API tạo ảnh</strong>. Nút &quot;Xem bố cục kết quả&quot; chỉ hiển thị các
        khung màu giữ chỗ để duyệt giao diện.
      </DemoNotice>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,30%)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionCard step={1} title="Sản phẩm & ảnh tham chiếu">
            <Field label="Sản phẩm" htmlFor="img-product">
              <NativeSelect
                id="img-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={products.loading ? 'Đang tải…' : 'Chọn sản phẩm (DEMO)'}
                options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
            {product ? (
              <div className="flex flex-wrap gap-1.5">
                {product.images.map((img) => (
                  <MediaPreview key={img.id} image={img} className="size-12 border" />
                ))}
              </div>
            ) : null}
            <FileUpload
              compact
              label="Tải ảnh tham chiếu"
              onFiles={(files) =>
                setReferences((prev) => [
                  ...prev,
                  ...files.map((f) => ({
                    id: f.id,
                    url: f.previewUrl,
                    hue: 30,
                    label: f.file.name,
                  })),
                ])
              }
            />
            {references.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {references.map((ref) => (
                  <li key={ref.id} className="relative">
                    <MediaPreview image={ref} className="size-14 border" />
                    <button
                      type="button"
                      aria-label={`Bỏ ${ref.label}`}
                      onClick={() => setReferences((prev) => prev.filter((r) => r.id !== ref.id))}
                      className="bg-sidebar text-sidebar-foreground absolute -top-1.5 -right-1.5 grid size-4 cursor-pointer place-items-center rounded-full"
                    >
                      <X className="size-2.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          <SectionCard step={2} title="Template & prompt">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Template ảnh">
              {IMAGE_TEMPLATES.map((t) => {
                const checked = t.id === templateId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => setTemplateId(t.id)}
                    className={cn(
                      'flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                      checked ? 'border-primary bg-primary/10' : 'hover:bg-accent/60',
                    )}
                  >
                    <span className="text-[13px] leading-tight font-medium">{t.name}</span>
                    <span className="text-muted-foreground text-[11px] leading-snug">{t.hint}</span>
                  </button>
                );
              })}
            </div>
            <PromptEditor
              label="Prompt"
              value={prompt}
              onChange={setPrompt}
              rows={4}
              maxLength={1000}
              placeholder="VD: Đặt sản phẩm trên bàn gỗ, ánh nắng buổi sáng, tông màu ấm…"
            />
          </SectionCard>

          <SectionCard step={3} title="Thông số">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Tỷ lệ ảnh</span>
              <OptionChips
                label="Tỷ lệ ảnh"
                value={aspect}
                onChange={setAspect}
                options={ASPECTS.map((a) => ({ value: a, label: a }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Số lượng ảnh</span>
              <OptionChips
                label="Số lượng ảnh"
                value={count}
                onChange={setCount}
                options={COUNTS.map((n) => ({ value: n, label: String(n) }))}
              />
            </div>
            <Field
              label="Nhà cung cấp AI"
              htmlFor="img-provider"
              badge={
                <UnavailableChip reason="Cấu hình provider ở Cài đặt → API Providers (Phase 04)" />
              }
            >
              <NativeSelect
                id="img-provider"
                disabled
                value=""
                placeholder="Chưa có provider được cấu hình"
                options={AI_PROVIDER_PLACEHOLDERS.map((p) => ({
                  value: p.id,
                  label: p.name,
                  disabled: true,
                }))}
              />
            </Field>
          </SectionCard>

          <div className="bg-card flex flex-col gap-2 rounded-xl border p-3.5 shadow-xs">
            <UnavailableButton reason="Cần image provider phía server – dự kiến Phase 04">
              <Sparkles /> Tạo {count} ảnh
            </UnavailableButton>
            <Button variant="outline" onClick={showDemoLayout}>
              <FlaskConical /> Xem bố cục kết quả (DEMO)
            </Button>
          </div>
        </div>

        <section
          aria-label="Kết quả"
          className="bg-card flex min-w-0 flex-col gap-4 rounded-xl border p-4 shadow-xs sm:p-5"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Kết quả</h2>
            {results.length ? <DemoBadge label="KHUNG MẪU" /> : null}
            {results.length ? (
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-xs">Đã chọn {selection.count}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    selection.setMany(
                      results.map((r) => r.id),
                      true,
                    )
                  }
                >
                  Chọn tất cả
                </Button>
                <UnavailableButton
                  size="sm"
                  variant="outline"
                  reason="Không có file thật để tải – Phase 04"
                >
                  <Download /> Tải xuống
                </UnavailableButton>
                <UnavailableButton
                  size="sm"
                  reason="Lưu vào thư viện cần storage API – Phase 02/04"
                >
                  <FolderPlus /> Lưu vào thư viện
                </UnavailableButton>
              </div>
            ) : null}
          </div>
          {results.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              className="py-20"
              title="Chưa có ảnh"
              description="Ảnh do AI tạo sẽ hiển thị tại đây (Phase 04). Hiện có thể xem bố cục bằng khung mẫu."
            />
          ) : (
            <ul
              className={cn(
                'grid gap-3',
                aspect === '16:9'
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
              )}
            >
              {results.map((img) => {
                const checked = selection.has(img.id);
                return (
                  <li key={img.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => setViewing(img)}
                      className={cn(
                        'block w-full cursor-pointer overflow-hidden rounded-lg border-2 transition-all outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50',
                        checked ? 'border-primary' : 'border-transparent',
                      )}
                      aria-label={`Xem lớn ${img.label}`}
                    >
                      <MediaPreview
                        image={img}
                        aspect={aspect}
                        className="w-full"
                        rounded=""
                        showLabel
                      />
                    </button>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      aria-label={`Chọn ${img.label}`}
                      onClick={() => selection.toggle(img.id)}
                      className={cn(
                        'absolute top-2 left-2 grid size-6 cursor-pointer place-items-center rounded-md border shadow-sm transition-colors',
                        checked
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-card/90 text-transparent hover:text-muted-foreground',
                      )}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </button>
                    <span className="bg-sidebar/85 text-sidebar-primary pointer-events-none absolute right-2 bottom-2 rounded px-1 text-[9px] font-bold tracking-wider">
                      DEMO
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <ImageViewerDialog
        image={viewing}
        original={original}
        aspect={aspect}
        onOpenChange={(open) => !open && setViewing(undefined)}
      />
    </>
  );
}
