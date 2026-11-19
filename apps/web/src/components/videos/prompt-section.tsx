'use client';

import { RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Field, OptionChips, PromptEditor, SectionCard } from '@/components/common';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { PROMPT_CATEGORIES, VIDEO_PROMPT_TEMPLATES } from '@/lib/data';
import { PROMPT_VARIABLES } from './factory-types';
import type { VideoFactoryState } from './use-video-factory';

const SAVED_KEY = 'acs.videoFactory.savedPrompt';

/** Khu vực 1: Nội dung & Prompt video. */
export function PromptSection({ state }: { state: VideoFactoryState }) {
  const { config, update, resetPrompt } = state;
  const templates = VIDEO_PROMPT_TEMPLATES.filter((t) => t.categoryId === config.promptCategory);

  const savePrompt = () => {
    try {
      window.localStorage.setItem(SAVED_KEY, config.prompt);
      toast.success('Đã lưu prompt trên trình duyệt này', {
        description: 'Lưu theo máy của bạn; đồng bộ tài khoản sẽ có khi có backend.',
      });
    } catch {
      toast.error('Không lưu được prompt', { description: 'Trình duyệt đang chặn bộ nhớ cục bộ.' });
    }
  };

  const loadSaved = () => {
    try {
      const saved = window.localStorage.getItem(SAVED_KEY);
      if (saved) {
        update('prompt', saved);
        toast.success('Đã nạp prompt đã lưu');
      } else {
        toast.info('Chưa có prompt nào được lưu trên trình duyệt này');
      }
    } catch {
      toast.error('Không đọc được bộ nhớ cục bộ');
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
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={savePrompt} disabled={!config.prompt.trim()}>
          <Save /> Lưu prompt
        </Button>
        <Button size="sm" variant="ghost" onClick={loadSaved}>
          Nạp prompt đã lưu
        </Button>
        <Button size="sm" variant="ghost" onClick={resetPrompt}>
          <RotateCcw /> Khôi phục mặc định
        </Button>
      </div>
    </SectionCard>
  );
}
