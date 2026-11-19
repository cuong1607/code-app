'use client';

import { Check, Copy, Pencil, RefreshCw, Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DemoBadge, UnavailableButton } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ScriptContent } from '@acs/shared';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function scriptToText(s: ScriptContent): string {
  const scenes = s.scenes
    .map(
      (sc) =>
        `Cảnh ${sc.order} (${sc.durationSeconds}s)\n- Lời thoại: ${sc.voiceover}\n- Hình ảnh: ${sc.visualPrompt}${sc.onScreenText ? `\n- Chữ trên màn hình: ${sc.onScreenText}` : ''}`,
    )
    .join('\n\n');
  return `${s.title}\n\nHOOK: ${s.hook}\n\nLỜI THOẠI:\n${s.voiceover}\n\n${scenes}\n\nCAPTION: ${s.caption}\nHASHTAG: ${s.hashtags.join(' ')}\nCTA: ${s.cta}`;
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  } catch {
    toast.error('Không sao chép được', {
      description: 'Trình duyệt chặn quyền truy cập clipboard.',
    });
  }
}

function Block({
  label,
  value,
  editing,
  onChange,
  multiline = false,
  className,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('group flex flex-col gap-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={`Sao chép ${label}`}
          onClick={() => copy(value, label.toLowerCase())}
        >
          <Copy />
        </Button>
      </div>
      {editing ? (
        multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            aria-label={label}
          />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        )
      ) : (
        <p className="text-[14px] leading-relaxed whitespace-pre-line">{value}</p>
      )}
    </div>
  );
}

/** Hiển thị & chỉnh sửa một kịch bản; "Lưu" ghi bản nháp vào database. */
export function ScriptResult({
  script,
  onChange,
  fromSample,
  saving,
  savedAt,
  onSave,
}: {
  script: ScriptContent;
  onChange: (script: ScriptContent) => void;
  /** Nội dung xuất phát từ khuôn mẫu (không phải AI) */
  fromSample: boolean;
  saving: boolean;
  savedAt?: string;
  onSave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const set = <K extends keyof ScriptContent>(key: K, value: ScriptContent[K]) =>
    onChange({ ...script, [key]: value });

  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {fromSample ? <DemoBadge label="TỪ KHUÔN MẪU – KHÔNG PHẢI AI" /> : null}
        {savedAt ? (
          <span className="text-muted-foreground text-xs">
            Đã lưu lúc {formatDateTime(savedAt)}
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={editing ? 'default' : 'outline'}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <Check /> : <Pencil />} {editing ? 'Xong' : 'Chỉnh sửa'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => copy(scriptToText(script), 'toàn bộ kịch bản')}
          >
            <Copy /> Sao chép
          </Button>
          <UnavailableButton
            size="sm"
            variant="outline"
            reason="Tạo lại cần AI script provider – dự kiến Phase 03"
          >
            <RefreshCw /> Tạo lại
          </UnavailableButton>
          <Button size="sm" onClick={onSave} disabled={saving || !script.title.trim()}>
            <Save /> {saving ? 'Đang lưu…' : 'Lưu nháp'}
          </Button>
        </div>
      </div>

      <Block
        label="Tiêu đề"
        value={script.title}
        editing={editing}
        onChange={(v) => set('title', v)}
      />
      <div className="bg-primary/8 border-primary/30 rounded-lg border p-3">
        <Block
          label="Hook (3 giây đầu)"
          value={script.hook}
          editing={editing}
          onChange={(v) => set('hook', v)}
          multiline
        />
      </div>
      <Block
        label="Lời thoại"
        value={script.voiceover}
        editing={editing}
        onChange={(v) => set('voiceover', v)}
        multiline
      />

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Danh sách cảnh ({script.scenes.length})
        </span>
        <ol className="flex flex-col gap-2">
          {script.scenes.map((scene, i) => (
            <li key={scene.order} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="bg-sidebar text-sidebar-primary tabular grid size-6 place-items-center rounded text-xs font-bold">
                  {scene.order}
                </span>
                <span className="text-sm font-medium">Cảnh {scene.order}</span>
                <span className="text-muted-foreground tabular ml-auto text-xs">
                  {scene.durationSeconds} giây
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(
                  [
                    ['voiceover', 'Lời thoại'],
                    ['visualPrompt', 'Visual prompt'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-[11px] font-medium">{label}</span>
                    {editing ? (
                      <Textarea
                        rows={2}
                        aria-label={`${label} cảnh ${scene.order}`}
                        value={scene[key]}
                        onChange={(e) =>
                          set(
                            'scenes',
                            script.scenes.map((s, j) =>
                              j === i ? { ...s, [key]: e.target.value } : s,
                            ),
                          )
                        }
                      />
                    ) : (
                      <p
                        className={cn(
                          'text-[13px] leading-relaxed',
                          key === 'visualPrompt' && 'text-muted-foreground font-mono text-xs',
                        )}
                      >
                        {scene[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {scene.onScreenText ? (
                <p className="mt-2 text-xs">
                  <span className="text-muted-foreground">Chữ trên màn hình: </span>
                  <span className="bg-sidebar text-sidebar-primary rounded px-1.5 py-0.5 font-semibold">
                    {scene.onScreenText}
                  </span>
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block
          label="Caption"
          value={script.caption}
          editing={editing}
          onChange={(v) => set('caption', v)}
          multiline
        />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Hashtag
            </span>
            <div className="flex flex-wrap gap-1.5">
              {script.hashtags.map((t) => (
                <span
                  key={t}
                  className="bg-info/10 text-info rounded px-2 py-0.5 text-xs font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <Block label="CTA" value={script.cta} editing={editing} onChange={(v) => set('cta', v)} />
        </div>
      </div>
    </article>
  );
}
