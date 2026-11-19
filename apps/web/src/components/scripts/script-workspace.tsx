'use client';

import {
  CircleAlert,
  Clapperboard,
  Copy,
  FileStack,
  Loader2,
  RotateCcw,
  Save,
  Star,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { estimateSpeechSeconds } from '@acs/shared';
import { ConfirmDialog, DemoBadge, EmptyState, StatusBadge } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateTime } from '@/lib/format';
import { SCRIPT_VALIDATION_META, type StatusMeta } from '@/lib/labels';
import { cn } from '@/lib/utils';
import {
  CaptionTab,
  HistoryTab,
  NarrationTab,
  OverviewTab,
  ScenesTab,
  copyText,
  scriptToText,
} from './script-tabs';
import type { ScriptStudioState } from './use-script-studio';

function GenerationBanner({ s }: { s: ScriptStudioState }) {
  const g = s.generation;
  if (g.status === 'generating')
    return (
      <div
        role="status"
        className="border-processing/30 bg-processing/8 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <Loader2 className="text-processing size-4 animate-spin" aria-hidden />
        <span>
          <strong>Đang tạo</strong> {g.count} phiên bản bằng AI… Có thể mất vài phút; kết quả được
          lưu tự động vào database.
        </span>
      </div>
    );
  if (g.status === 'failed')
    return (
      <div
        role="alert"
        className="border-danger/30 bg-danger/8 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <CircleAlert className="text-danger mt-0.5 size-4" aria-hidden />
        <span>
          <strong>Thất bại:</strong> {g.message}
        </span>
      </div>
    );
  if (g.status === 'done')
    return (
      <div
        role="status"
        className="border-success/30 bg-success/8 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
      >
        <span>
          <strong>Hoàn thành</strong>: {g.result.succeeded}/{g.result.requested} phiên bản ·{' '}
          {g.result.provider}/{g.result.model} ·{' '}
          {g.result.usage.inputTokens.toLocaleString('vi-VN')} token vào,{' '}
          {g.result.usage.outputTokens.toLocaleString('vi-VN')} token ra · ~$
          {Number(g.result.usage.estimatedCostUsd).toFixed(4)} (ước tính)
        </span>
        {g.result.isMock ? <DemoBadge label="MOCK – KHÔNG PHẢI AI" /> : null}
      </div>
    );
  return null;
}

function VariantCompare({ s }: { s: ScriptStudioState }) {
  const failed =
    s.generation.status === 'done'
      ? s.generation.result.items.filter((i) => i.status === 'failed')
      : [];
  if (s.variants.length < 2 && !failed.length) return null;
  return (
    <section aria-label="So sánh phiên bản" className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-left text-xs whitespace-nowrap">
          <tr>
            <th className="px-2 py-1.5 font-medium">#</th>
            <th className="px-2 py-1.5 font-medium">Hướng triển khai</th>
            <th className="px-2 py-1.5 font-medium">Hook</th>
            <th className="px-2 py-1.5 text-right font-medium">Cảnh</th>
            <th className="px-2 py-1.5 text-right font-medium">Đọc ~</th>
            <th className="px-2 py-1.5 font-medium">Kiểm tra</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {s.variants.map((v) => {
            const active = s.open?.saved?.rootId === v.rootId;
            return (
              <tr
                key={v.id}
                className={cn(
                  'cursor-pointer border-t hover:bg-accent/50',
                  active && 'bg-primary/8',
                )}
                onClick={() => void s.openScript(v.id)}
              >
                <td className="tabular px-2 py-1.5">{v.variantIndex ?? '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {v.changeNote?.replace(/^Tạo bằng AI – /, '') ?? v.angleId}
                </td>
                <td className="max-w-[18rem] truncate px-2 py-1.5" title={v.document.hook}>
                  {v.document.hook}
                </td>
                <td className="tabular px-2 py-1.5 text-right">{v.document.scenes.length}</td>
                <td className="tabular px-2 py-1.5 text-right">
                  {Math.round(estimateSpeechSeconds(v.document.narration, s.speechSpeed))}s
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge meta={SCRIPT_VALIDATION_META[v.validationStatus]} />
                </td>
                <td className="px-2 py-1.5 text-right">
                  {v.isPreferred ? (
                    <Badge variant="success">
                      <Star /> Tốt nhất
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        void s.setPreferred(v.id);
                      }}
                    >
                      <Star /> Chọn tốt nhất
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
          {failed.map((f) => (
            <tr key={`f-${f.variantIndex}`} className="border-t">
              <td className="tabular px-2 py-1.5">{f.variantIndex}</td>
              <td className="px-2 py-1.5">{f.angleLabel}</td>
              <td colSpan={5} className="text-danger px-2 py-1.5">
                Thất bại: {f.error?.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ScriptWorkspace({ s }: { s: ScriptStudioState }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('script');
  const o = s.open;

  if (!o)
    return (
      <div className="flex flex-col gap-3">
        <GenerationBanner s={s} />
        <EmptyState
          icon={Wand2}
          className="py-20"
          title={
            s.generation.status === 'generating' ? 'AI đang viết kịch bản…' : 'Chưa có kịch bản'
          }
          description="Chọn sản phẩm và cấu hình bên trái rồi bấm “Tạo kịch bản bằng AI”, hoặc mở một kịch bản đã lưu."
        />
      </div>
    );

  const saved = o.saved;
  const docStatus: StatusMeta = o.dirty
    ? { label: 'Chưa lưu', tone: 'warning' }
    : { label: 'Đã lưu', tone: 'success' };
  const canRegenerate = Boolean(saved?.productId) && !o.sample;

  return (
    <div className="flex flex-col gap-3">
      <GenerationBanner s={s} />
      <VariantCompare s={s} />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge meta={docStatus} />
        {saved ? (
          <Badge variant="outline">
            Phiên bản {saved.versionNumber}/{saved.latestVersionNumber}
          </Badge>
        ) : null}
        {saved ? <StatusBadge meta={SCRIPT_VALIDATION_META[saved.validationStatus]} /> : null}
        {saved?.isMock ? <DemoBadge label="MOCK – KHÔNG PHẢI AI" /> : null}
        {o.sample || saved?.origin === 'sample' ? (
          <DemoBadge label="TỪ KHUÔN MẪU – KHÔNG PHẢI AI" />
        ) : null}
        {saved?.provider && !saved.isMock ? (
          <Badge variant="info">
            {saved.provider} · {saved.model}
          </Badge>
        ) : null}
        {saved ? (
          <span className="text-muted-foreground text-xs">
            Cập nhật {formatDateTime(saved.updatedAt)}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copyText(scriptToText(o.doc), 'toàn bộ kịch bản')}
          >
            <Copy /> Sao chép
          </Button>
          {o.dirty && saved ? (
            <Button size="sm" variant="ghost" onClick={s.discard}>
              <RotateCcw /> Bỏ thay đổi
            </Button>
          ) : null}
          {saved ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!o.dirty || Boolean(s.busy)}
              onClick={() => void s.saveAsVersion()}
            >
              <FileStack /> Lưu thành phiên bản mới
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={(!o.dirty && Boolean(saved)) || Boolean(s.busy) || !o.doc.title.trim()}
            onClick={() => void s.save()}
          >
            {s.busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />} Lưu
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-3">
        <TabsList aria-label="Nội dung kịch bản">
          <TabsTrigger value="script">Kịch bản</TabsTrigger>
          <TabsTrigger value="scenes">Phân cảnh ({o.doc.scenes.length})</TabsTrigger>
          <TabsTrigger value="narration">Lời thoại</TabsTrigger>
          <TabsTrigger value="caption">Caption và hashtag</TabsTrigger>
          <TabsTrigger value="history">
            Lịch sử phiên bản{saved ? ` (${saved.versions.length})` : ''}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="script">
          <OverviewTab doc={o.doc} saved={saved} onChange={s.setDoc} speed={s.speechSpeed} />
        </TabsContent>
        <TabsContent value="scenes">
          <ScenesTab
            doc={o.doc}
            onChange={s.setDoc}
            canRegenerate={canRegenerate}
            busy={s.busy}
            speed={s.speechSpeed}
            onRegenerate={(i, hint) => void s.regenerate('scene', i, hint)}
          />
        </TabsContent>
        <TabsContent value="narration">
          <NarrationTab doc={o.doc} speed={s.speechSpeed} />
        </TabsContent>
        <TabsContent value="caption">
          <CaptionTab
            key={`${saved?.id ?? 'new'}-${saved?.updatedAt ?? ''}`}
            doc={o.doc}
            onChange={s.setDoc}
            canRegenerate={canRegenerate}
            busy={s.busy}
            onRegenerate={(hint) => void s.regenerate('caption', undefined, hint)}
          />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab saved={saved} onOpen={(id) => void s.openScript(id)} />
        </TabsContent>
      </Tabs>

      {saved ? (
        <div className="flex flex-wrap gap-1.5 border-t pt-3">
          <Button
            size="sm"
            variant="outline"
            disabled={o.dirty || !saved.productId}
            title={
              o.dirty
                ? 'Lưu thay đổi trước'
                : !saved.productId
                  ? 'Kịch bản chưa gắn sản phẩm'
                  : undefined
            }
            onClick={() =>
              router.push(`/studio/videos?products=${saved.productId}&script=${saved.id}`)
            }
          >
            <Clapperboard /> Dùng làm đầu vào tạo video
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-danger ml-auto"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 /> Xoá kịch bản
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        title="Xoá kịch bản?"
        description={`Kịch bản và toàn bộ ${saved?.versions.length ?? 0} phiên bản sẽ bị xoá khỏi database.`}
        confirmLabel="Xoá"
        onConfirm={() => void s.remove()}
      />
    </div>
  );
}
