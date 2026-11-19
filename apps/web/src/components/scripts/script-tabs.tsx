'use client';

import { ArrowDown, ArrowUp, Copy, History, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  SCENE_TYPES,
  type ScriptDetail,
  type ScriptDocument,
  type ScriptIssue,
  type ScriptScene,
  VISUAL_SOURCES,
  estimateSpeechSeconds,
} from '@acs/shared';
import { Field, StatusBadge } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '@/lib/format';
import {
  SCENE_TYPE_LABEL,
  SCRIPT_ORIGIN_LABEL,
  SCRIPT_VALIDATION_META,
  VISUAL_SOURCE_LABEL,
} from '@/lib/labels';
import { cn } from '@/lib/utils';

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  } catch {
    toast.error('Không sao chép được', {
      description: 'Trình duyệt chặn quyền truy cập clipboard.',
    });
  }
}

export function scriptToText(d: ScriptDocument): string {
  const scenes = d.scenes
    .map(
      (s) =>
        `Cảnh ${s.index} – ${SCENE_TYPE_LABEL[s.sceneType]} (${s.durationHintSeconds}s)\n- Lời thoại: ${s.spokenText}\n- Chữ trên màn hình: ${s.overlayText}\n- Visual prompt: ${s.visualPrompt}\n- Nguồn hình: ${VISUAL_SOURCE_LABEL[s.visualSource]}`,
    )
    .join('\n\n');
  return `${d.title}\n\nHOOK: ${d.hook}\n\nLỜI THOẠI:\n${d.narration}\n\n${scenes}\n\nCAPTION: ${d.caption}\nHASHTAG: ${d.hashtags.join(' ')}\nCTA: ${d.cta}`;
}

const sec = (n: number) => `${Math.round(n * 10) / 10}s`;

function IssueList({ issues, flags }: { issues: ScriptIssue[]; flags: string[] }) {
  if (!issues.length && !flags.length)
    return <p className="text-success text-sm">Không phát hiện vấn đề nào.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label="Cảnh báo kiểm tra">
      {issues.map((i, n) => (
        <li key={`${i.code}-${i.path}-${n}`} className="flex items-start gap-2">
          <Badge variant={i.severity === 'error' ? 'danger' : 'warning'}>
            {i.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
          </Badge>
          <span>{i.message}</span>
        </li>
      ))}
      {flags
        .filter((f) => !f.startsWith('[Kiểm tra tự động]'))
        .map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Badge variant="neutral">AI ghi chú</Badge>
            <span>{f}</span>
          </li>
        ))}
    </ul>
  );
}

// ------------------------------------------------------------------ Tab: Kịch bản
export function OverviewTab({
  doc,
  saved,
  onChange,
  speed,
}: {
  doc: ScriptDocument;
  saved: ScriptDetail | null;
  onChange: (d: ScriptDocument) => void;
  speed: number;
}) {
  const est = estimateSpeechSeconds(doc.narration, speed);
  const total = doc.scenes.reduce((s, x) => s + x.durationHintSeconds, 0);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Tiêu đề" htmlFor="sd-title">
        <Input
          id="sd-title"
          value={doc.title}
          maxLength={200}
          onChange={(e) => onChange({ ...doc, title: e.target.value })}
        />
      </Field>
      <div className="bg-primary/8 border-primary/30 rounded-lg border p-3">
        <Field label="Hook (3 giây đầu)" htmlFor="sd-hook">
          <Textarea
            id="sd-hook"
            rows={2}
            value={doc.hook}
            maxLength={300}
            onChange={(e) => onChange({ ...doc, hook: e.target.value })}
          />
        </Field>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">Thời lượng mục tiêu</dt>
          <dd className="tabular font-semibold">{doc.targetDurationSeconds}s</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">Tổng thời lượng cảnh</dt>
          <dd className="tabular font-semibold">{sec(total)}</dd>
        </div>
        <div className="rounded-lg border p-3">
          <dt className="text-muted-foreground text-xs">Đọc dự kiến (ước tính)</dt>
          <dd className="tabular font-semibold">~{sec(est)}</dd>
        </div>
      </dl>
      {saved ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Kiểm tra tự động (lúc lưu)</h3>
          <IssueList issues={saved.issues} flags={doc.complianceFlags} />
        </div>
      ) : null}
      {saved ? (
        <dl className="text-muted-foreground grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="inline">Nguồn: </dt>
            <dd className="inline">{SCRIPT_ORIGIN_LABEL[saved.origin]}</dd>
          </div>
          <div>
            <dt className="inline">Provider / model: </dt>
            <dd className="inline">
              {saved.provider ? `${saved.provider} · ${saved.model ?? '—'}` : 'Không dùng AI'}
            </dd>
          </div>
          <div>
            <dt className="inline">Template: </dt>
            <dd className="inline">
              {saved.templateId ? `${saved.templateId} v${saved.templateVersion ?? '?'}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="inline">Token (phiên bản này): </dt>
            <dd className="inline tabular">
              {saved.usage
                ? `${saved.usage.inputTokens.toLocaleString('vi-VN')} vào · ${saved.usage.outputTokens.toLocaleString('vi-VN')} ra · ~$${Number(saved.usage.estimatedCostUsd).toFixed(4)} (ước tính)`
                : 'Không có (không gọi AI)'}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ Tab: Phân cảnh
export function ScenesTab({
  doc,
  onChange,
  canRegenerate,
  busy,
  onRegenerate,
  speed,
}: {
  doc: ScriptDocument;
  onChange: (d: ScriptDocument) => void;
  canRegenerate: boolean;
  busy: string | null;
  onRegenerate: (index: number, instructions: string) => void;
  speed: number;
}) {
  const [hints, setHints] = useState<Record<number, string>>({});
  const setScene = (i: number, patch: Partial<ScriptScene>) =>
    onChange({ ...doc, scenes: doc.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const scenes = [...doc.scenes];
    const [x] = scenes.splice(i, 1);
    scenes.splice(i + d, 0, x!);
    onChange({ ...doc, scenes });
  };
  const add = () =>
    onChange({
      ...doc,
      scenes: [
        ...doc.scenes,
        {
          index: doc.scenes.length + 1,
          sceneType: 'FEATURE',
          durationHintSeconds: 4,
          description: '',
          visualPrompt: '',
          spokenText: 'Lời thoại cảnh mới.',
          overlayText: '',
          visualSource: 'PRODUCT_IMAGE',
        },
      ],
    });

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3" aria-label="Danh sách cảnh">
        {doc.scenes.map((s, i) => {
          const est = estimateSpeechSeconds(s.spokenText, speed);
          const long = est > s.durationHintSeconds * 1.4 + 0.5;
          const regenBusy = busy === `scene-${s.index}`;
          return (
            <li
              key={`${s.index}-${i}`}
              className="rounded-lg border p-3"
              aria-label={`Cảnh ${s.index}`}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="bg-sidebar text-sidebar-primary tabular grid size-6 place-items-center rounded text-xs font-bold">
                  {s.index}
                </span>
                <NativeSelect
                  aria-label={`Loại cảnh ${s.index}`}
                  className="w-40"
                  value={s.sceneType}
                  onChange={(e) =>
                    setScene(i, { sceneType: e.target.value as ScriptScene['sceneType'] })
                  }
                  options={SCENE_TYPES.map((t) => ({ value: t, label: SCENE_TYPE_LABEL[t] }))}
                />
                <label className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Giây</span>
                  <Input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    className="h-8 w-20"
                    aria-label={`Thời lượng cảnh ${s.index}`}
                    value={s.durationHintSeconds}
                    onChange={(e) =>
                      setScene(i, {
                        durationHintSeconds: Math.min(
                          30,
                          Math.max(0.5, Number(e.target.value) || 0.5),
                        ),
                      })
                    }
                  />
                </label>
                <span
                  className={cn('tabular text-xs', long ? 'text-danger' : 'text-muted-foreground')}
                >
                  đọc ~{sec(est)}
                </span>
                <div className="ml-auto flex gap-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Đưa cảnh ${s.index} lên`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Đưa cảnh ${s.index} xuống`}
                    disabled={i === doc.scenes.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={`Xoá cảnh ${s.index}`}
                    disabled={doc.scenes.length <= 1}
                    onClick={() =>
                      onChange({ ...doc, scenes: doc.scenes.filter((_, j) => j !== i) })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Lời thoại (đọc TTS)" htmlFor={`sc-spoken-${i}`}>
                  <Textarea
                    id={`sc-spoken-${i}`}
                    rows={3}
                    maxLength={600}
                    value={s.spokenText}
                    onChange={(e) => setScene(i, { spokenText: e.target.value })}
                  />
                </Field>
                <Field label="Visual prompt" htmlFor={`sc-visual-${i}`}>
                  <Textarea
                    id={`sc-visual-${i}`}
                    rows={3}
                    maxLength={1500}
                    className="font-mono text-xs"
                    value={s.visualPrompt}
                    onChange={(e) => setScene(i, { visualPrompt: e.target.value })}
                  />
                </Field>
                <Field label="Chữ trên màn hình" htmlFor={`sc-overlay-${i}`}>
                  <Input
                    id={`sc-overlay-${i}`}
                    maxLength={120}
                    value={s.overlayText}
                    onChange={(e) => setScene(i, { overlayText: e.target.value })}
                  />
                </Field>
                <Field label="Nguồn hình ảnh" htmlFor={`sc-source-${i}`}>
                  <NativeSelect
                    id={`sc-source-${i}`}
                    value={s.visualSource}
                    onChange={(e) =>
                      setScene(i, { visualSource: e.target.value as ScriptScene['visualSource'] })
                    }
                    options={VISUAL_SOURCES.map((v) => ({
                      value: v,
                      label: VISUAL_SOURCE_LABEL[v],
                    }))}
                  />
                </Field>
                <Field label="Mô tả cảnh" htmlFor={`sc-desc-${i}`} className="md:col-span-2">
                  <Input
                    id={`sc-desc-${i}`}
                    maxLength={500}
                    value={s.description}
                    onChange={(e) => setScene(i, { description: e.target.value })}
                  />
                </Field>
              </div>
              {canRegenerate ? (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                  <Input
                    aria-label={`Yêu cầu khi tạo lại cảnh ${s.index}`}
                    placeholder="Yêu cầu khi tạo lại (tuỳ chọn)"
                    className="h-8 min-w-0 flex-1"
                    maxLength={800}
                    value={hints[s.index] ?? ''}
                    onChange={(e) => setHints((h) => ({ ...h, [s.index]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(busy)}
                    onClick={() => onRegenerate(s.index, hints[s.index] ?? '')}
                  >
                    {regenBusy ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tạo lại cảnh{' '}
                    {s.index}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={doc.scenes.length >= 30}
        onClick={add}
      >
        <Plus /> Thêm cảnh
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ Tab: Lời thoại
export function NarrationTab({ doc, speed }: { doc: ScriptDocument; speed: number }) {
  const total = estimateSpeechSeconds(doc.narration, speed);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">
          Thời lượng đọc <strong>dự kiến</strong> ~{sec(total)} ở tốc độ {speed}x
          <span className="text-muted-foreground">
            {' '}
            – là ước tính, không phải thời lượng audio thực tế (có sau khi tạo giọng đọc ở Phase
            05).
          </span>
        </p>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => void copyText(doc.narration, 'lời thoại')}
        >
          <Copy /> Sao chép lời thoại
        </Button>
      </div>
      <div className="bg-muted/40 rounded-lg border p-3">
        <p className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          Toàn bộ lời thoại (tự ghép từ lời thoại các cảnh – sửa ở tab Phân cảnh)
        </p>
        <p className="text-[15px] leading-relaxed" data-testid="narration">
          {doc.narration}
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th className="py-1 pr-2 font-medium">Cảnh</th>
            <th className="py-1 pr-2 font-medium">Lời thoại</th>
            <th className="py-1 text-right font-medium">Gợi ý</th>
            <th className="py-1 text-right font-medium">Đọc ~</th>
          </tr>
        </thead>
        <tbody>
          {doc.scenes.map((s) => (
            <tr key={s.index} className="border-t align-top">
              <td className="tabular py-1.5 pr-2">{s.index}</td>
              <td className="py-1.5 pr-2">{s.spokenText}</td>
              <td className="tabular py-1.5 text-right">{sec(s.durationHintSeconds)}</td>
              <td className="tabular py-1.5 text-right">
                {sec(estimateSpeechSeconds(s.spokenText, speed))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ Tab: Caption & hashtag
export function CaptionTab({
  doc,
  onChange,
  canRegenerate,
  busy,
  onRegenerate,
}: {
  doc: ScriptDocument;
  onChange: (d: ScriptDocument) => void;
  canRegenerate: boolean;
  busy: string | null;
  onRegenerate: (instructions: string) => void;
}) {
  const [tags, setTags] = useState(doc.hashtags.join(' '));
  const [hint, setHint] = useState('');
  const commitTags = (v: string) =>
    onChange({
      ...doc,
      hashtags: [
        ...new Set(
          v
            .split(/[\s,]+/)
            .filter(Boolean)
            .map((t) => (t.startsWith('#') ? t : `#${t}`)),
        ),
      ].slice(0, 30),
    });
  return (
    <div className="flex flex-col gap-4">
      <Field label="Caption" htmlFor="sd-caption" hint={`${doc.caption.length}/2200 ký tự`}>
        <Textarea
          id="sd-caption"
          rows={4}
          maxLength={2200}
          value={doc.caption}
          onChange={(e) => onChange({ ...doc, caption: e.target.value })}
        />
      </Field>
      <Field
        label="Hashtag"
        htmlFor="sd-tags"
        hint="Cách nhau bởi dấu cách; không dấu cách bên trong hashtag"
      >
        <Input
          id="sd-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={(e) => commitTags(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5" aria-label="Hashtag hiện tại">
        {doc.hashtags.map((t) => (
          <span key={t} className="bg-info/10 text-info rounded px-2 py-0.5 text-xs font-medium">
            {t}
          </span>
        ))}
      </div>
      <Field label="CTA" htmlFor="sd-cta">
        <Input
          id="sd-cta"
          maxLength={300}
          value={doc.cta}
          onChange={(e) => onChange({ ...doc, cta: e.target.value })}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void copyText(`${doc.caption}\n\n${doc.hashtags.join(' ')}`, 'caption và hashtag')
          }
        >
          <Copy /> Sao chép caption + hashtag
        </Button>
        {canRegenerate ? (
          <>
            <Input
              aria-label="Yêu cầu khi tạo lại caption"
              placeholder="Yêu cầu (tuỳ chọn)"
              className="h-8 min-w-0 flex-1"
              maxLength={800}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => onRegenerate(hint)}
            >
              {busy === 'caption' ? <Loader2 className="animate-spin" /> : <RefreshCw />} Tạo lại
              caption bằng AI
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Tab: Lịch sử phiên bản
export function HistoryTab({
  saved,
  onOpen,
}: {
  saved: ScriptDetail | null;
  onOpen: (id: string) => void;
}) {
  if (!saved)
    return (
      <p className="text-muted-foreground text-sm">
        Kịch bản chưa được lưu – chưa có lịch sử phiên bản.
      </p>
    );
  return (
    <ol className="flex flex-col gap-2" aria-label="Lịch sử phiên bản">
      {saved.versions.map((v) => {
        const current = v.id === saved.id;
        return (
          <li
            key={v.id}
            className={cn(
              'flex flex-wrap items-center gap-2 rounded-lg border p-2.5',
              current && 'border-primary bg-primary/8',
            )}
          >
            <History className="text-muted-foreground size-4" aria-hidden />
            <span className="text-sm font-semibold">Phiên bản {v.versionNumber}</span>
            <StatusBadge meta={SCRIPT_VALIDATION_META[v.validationStatus]} />
            <span className="text-muted-foreground text-xs">
              {v.changeNote ?? SCRIPT_ORIGIN_LABEL[v.origin]}
              {v.provider ? ` · ${v.provider}${v.model ? `/${v.model}` : ''}` : ''} ·{' '}
              {formatDateTime(v.createdAt)}
            </span>
            {current ? (
              <Badge variant="info" className="ml-auto">
                Đang mở
              </Badge>
            ) : (
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => onOpen(v.id)}>
                Mở phiên bản {v.versionNumber}
              </Button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
