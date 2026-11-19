'use client';

import { Download, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Field, OptionChips, PromptEditor, SectionCard } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useAsync } from '@/hooks/use-async';
import { describeError } from '@/lib/api/client';
import { PROMPT_CATEGORIES, VIDEO_PROMPT_TEMPLATES, promptPresetRepository } from '@/lib/data';
import { PROMPT_VARIABLES } from './factory-types';
import type { VideoFactoryState } from './use-video-factory';

/** Khoá localStorage của Phase 01 – chỉ ĐỌC để người dùng chủ động chuyển vào DB, không tự xoá. */
const LEGACY_KEY = 'acs.videoFactory.savedPrompt';

function readLegacyPrompt(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

/** Khu vực 1: Nội dung & Prompt video. Prompt lưu vào DATABASE (prompt_presets). */
export function PromptSection({ state }: { state: VideoFactoryState }) {
  const { config, update, resetPrompt } = state;
  const templates = VIDEO_PROMPT_TEMPLATES.filter((t) => t.categoryId === config.promptCategory);
  const presets = useAsync(() => promptPresetRepository.list('video'), []);
  const [presetId, setPresetId] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [legacy, setLegacy] = useState<string | null>(null);

  const save = async (content = config.prompt, presetName = name.trim()) => {
    if (!presetName) {
      toast.error('Nhập tên cho prompt trước khi lưu');
      return;
    }
    setSaving(true);
    try {
      await promptPresetRepository.create({
        scope: 'video',
        name: presetName,
        content,
        category: config.promptCategory,
      });
      toast.success(`Đã lưu prompt "${presetName}" vào database`);
      setName('');
      presets.reload();
    } catch (error) {
      toast.error('Không lưu được prompt', { description: describeError(error) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const preset = presets.data?.find((p) => p.id === presetId);
    if (!preset) return;
    try {
      await promptPresetRepository.remove(preset.id);
      toast.success(`Đã xoá prompt "${preset.name}"`);
      setPresetId('');
      presets.reload();
    } catch (error) {
      toast.error('Không xoá được prompt', { description: describeError(error) });
    }
  };

  return (
    <SectionCard step={1} title="Nội dung & Prompt video">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Danh mục prompt</span>
        <OptionChips
          label="Danh mục prompt"
          size="sm"
          value={config.promptCategory}
          onChange={(categoryId) => {
            update('promptCategory', categoryId);
            const first = VIDEO_PROMPT_TEMPLATES.find((t) => t.categoryId === categoryId);
            if (first) {
              update('promptTemplateId', first.id);
              update('prompt', first.content);
            }
          }}
          options={PROMPT_CATEGORIES.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
      <Field label="Template prompt" htmlFor="vf-template">
        <NativeSelect
          id="vf-template"
          value={config.promptTemplateId}
          onChange={(e) => {
            const tpl = VIDEO_PROMPT_TEMPLATES.find((t) => t.id === e.target.value);
            update('promptTemplateId', e.target.value);
            if (tpl) update('prompt', tpl.content);
          }}
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
        />
      </Field>
      <PromptEditor
        label="Prompt video"
        value={config.prompt}
        onChange={(v) => update('prompt', v)}
        rows={7}
        maxLength={1500}
        variables={PROMPT_VARIABLES}
        placeholder="Mô tả nội dung, nhịp độ, phong cách video…"
      />

      <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2.5">
        <span className="text-xs font-semibold">Prompt đã lưu</span>
        <div className="flex gap-1.5">
          <NativeSelect
            aria-label="Chọn prompt đã lưu"
            className="min-w-0 flex-1"
            value={presetId}
            onChange={(e) => {
              setPresetId(e.target.value);
              const p = presets.data?.find((x) => x.id === e.target.value);
              if (p) update('prompt', p.content);
            }}
            placeholder={
              presets.loading
                ? 'Đang tải…'
                : presets.data?.length
                  ? 'Nạp prompt đã lưu…'
                  : 'Chưa có prompt đã lưu'
            }
            options={(presets.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <Button
            size="icon"
            variant="outline"
            aria-label="Xoá prompt đã chọn"
            disabled={!presetId}
            onClick={() => void remove()}
          >
            <Trash2 />
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Input
            aria-label="Tên prompt để lưu"
            placeholder="Tên prompt, VD: Chốt đơn mùa sale"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() => void save()}
            disabled={saving || !config.prompt.trim()}
          >
            <Save /> Lưu
          </Button>
        </div>
        {legacy ? (
          <div className="bg-muted/60 flex flex-col gap-1.5 rounded p-2 text-xs">
            <span>Tìm thấy prompt lưu trên trình duyệt (Phase 01). Dữ liệu này không bị xoá.</span>
            <Button
              size="xs"
              variant="outline"
              className="self-start"
              disabled={saving}
              onClick={() =>
                void save(
                  legacy,
                  `Prompt từ trình duyệt ${new Date().toLocaleDateString('vi-VN')}`,
                ).then(() => setLegacy(null))
              }
            >
              <Download /> Chuyển vào database
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground self-start text-[11px] underline-offset-2 hover:underline"
            onClick={() => {
              const v = readLegacyPrompt();
              if (v) setLegacy(v);
              else toast.info('Không có prompt cũ nào lưu trên trình duyệt này');
            }}
          >
            Kiểm tra prompt cũ lưu trên trình duyệt
          </button>
        )}
      </div>

      <Button size="sm" variant="ghost" className="self-start" onClick={resetPrompt}>
        <RotateCcw /> Khôi phục mặc định
      </Button>
    </SectionCard>
  );
}
