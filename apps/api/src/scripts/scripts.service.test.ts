import { describe, expect, it, vi } from 'vitest';
import type { ScriptDraft } from '@prisma/client';
import type { AiUsageService } from '../ai/ai-usage.service';
import type { PrismaService } from '../prisma/prisma.service';
import { toScriptDto } from './script.mapper';
import { ScriptsService } from './scripts.service';

describe('ScriptsService – cô lập workspace', () => {
  it('truy vấn luôn kèm workspaceId; không thuộc workspace -> NOT_FOUND', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { scriptDraft: { findFirst } } as unknown as PrismaService;
    const svc = new ScriptsService(prisma, {} as AiUsageService);
    await expect(svc.findOwned('ws-a', 'id-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(findFirst.mock.calls[0]![0].where).toEqual({ id: 'id-1', workspaceId: 'ws-a' });
  });
});

describe('Mapper – bản nháp Phase 02', () => {
  it('đọc content v1 cũ thành ScriptDocument v2, kiểm tra ở chế độ cảnh báo', () => {
    const row = {
      id: '00000000-0000-4000-8000-0000000000a1',
      workspaceId: 'ws',
      productId: null,
      rootId: '00000000-0000-4000-8000-0000000000a1',
      parentId: null,
      versionNumber: 1,
      origin: 'legacy',
      changeNote: null,
      templateId: null,
      templateVersion: null,
      provider: null,
      model: null,
      style: null,
      targetDurationSec: null,
      title: 'Kịch bản cũ',
      hook: null,
      narration: null,
      caption: null,
      hashtags: [],
      cta: null,
      content: {
        title: 'Kịch bản cũ',
        hook: 'Hook',
        voiceover: 'Lời',
        scenes: [
          { order: 1, durationSeconds: 4, voiceover: 'Xin chào các bạn', visualPrompt: 'v' },
        ],
        caption: 'c',
        hashtags: ['#a'],
        cta: 'Mua',
      },
      issues: [],
      validationStatus: 'unchecked',
      variantGroupId: null,
      variantIndex: null,
      angleId: null,
      isPreferred: false,
      config: { style: 'review' },
      createdAt: new Date('2026-11-19T00:00:00Z'),
      updatedAt: new Date('2026-11-19T00:00:00Z'),
    } as unknown as ScriptDraft;
    const dto = toScriptDto(row, 1);
    expect(dto.document.schemaVersion).toBe(2);
    expect(dto.document.narration).toBe('Xin chào các bạn');
    expect(dto.origin).toBe('legacy');
    expect(dto.issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(dto.estimatedSpeechSeconds).toBeGreaterThan(0);
  });
});
