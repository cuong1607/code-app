'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type Product,
  type Script,
  type ScriptDetail,
  type ScriptDocument,
  type ScriptGenerateRequest,
  type ScriptGenerationResult,
  type ScriptProviderId,
  SCRIPT_VARIANT_COUNTS,
  normalizeScriptDocument,
} from '@acs/shared';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { describeError } from '@/lib/api/client';
import { scriptRepository, settingsRepository } from '@/lib/data';
import { buildSampleScript } from '@/lib/sample-script';

export interface StudioConfig {
  templateId: string;
  durationSeconds: number;
  audienceId: string;
  toneId: string;
  hookStyleId: string;
  ctaStyleId: string;
  variantCount: number;
  provider: ScriptProviderId | null;
  model: string | null;
  temperature: number | null;
  includePrice: boolean;
  customInstructions: string;
}

export type GenerationState =
  | { status: 'idle' }
  | { status: 'generating'; startedAt: number; count: number }
  | { status: 'done'; result: ScriptGenerationResult }
  | { status: 'failed'; message: string; code?: string };

/** Kịch bản đang mở: bản lưu trên server + bản đang sửa (chưa lưu). */
export interface OpenScript {
  saved: ScriptDetail | null;
  /** Kịch bản soạn từ khuôn mẫu chưa lưu (không có trên server) */
  sample: boolean;
  doc: ScriptDocument;
  dirty: boolean;
}

/**
 * State của AI Script Studio.
 * - Chỉ gọi AI khi bấm "Tạo kịch bản" / "Tạo lại" – chuyển tab hay mở kịch bản đã lưu KHÔNG gọi AI.
 * - Ước tính chi phí gọi /scripts/estimate (không tốn token), có debounce.
 */
export function useScriptStudio(initialScriptId: string | null) {
  const templates = useAsync(() => scriptRepository.templates(), []);
  const providers = useAsync(() => scriptRepository.providers(), []);
  const settings = useAsync(() => settingsRepository.get(), []);
  const saved = useAsync(() => scriptRepository.list({ limit: 60 }), []);
  const prefs = settings.data?.preferences;

  const [products, setProducts] = useState<Product[]>([]);
  const [cfg, setCfg] = useState<Partial<StudioConfig>>({});
  const [generation, setGeneration] = useState<GenerationState>({ status: 'idle' });
  const [variants, setVariants] = useState<Script[]>([]);
  const [open, setOpen] = useState<OpenScript | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // ---------------------------------------------------------------- cấu hình (mặc định từ Cài đặt)
  const maxVariants = prefs?.ai.maxVariants ?? 5;
  const providerId = cfg.provider ?? providers.data?.defaultProvider ?? null;
  const providerStatus = providers.data?.providers.find((p) => p.id === providerId);
  const prefModel = prefs?.ai.defaultProvider === providerId ? prefs?.ai.defaultModel : null;
  const allowedCounts = SCRIPT_VARIANT_COUNTS.filter((n) => n <= maxVariants);
  const config: StudioConfig = {
    templateId: cfg.templateId ?? prefs?.ai.defaultTemplateId ?? 'review',
    durationSeconds: cfg.durationSeconds ?? 30,
    audienceId: cfg.audienceId ?? 'general',
    toneId: cfg.toneId ?? 'friendly',
    hookStyleId: cfg.hookStyleId ?? 'question',
    ctaStyleId: cfg.ctaStyleId ?? 'soft',
    variantCount: Math.min(cfg.variantCount ?? 3, allowedCounts.at(-1) ?? 1),
    provider: providerId,
    model: cfg.model ?? prefModel ?? providerStatus?.defaultModel ?? null,
    temperature: cfg.temperature ?? null,
    includePrice: cfg.includePrice ?? prefs?.ai.includePriceByDefault ?? false,
    customInstructions: cfg.customInstructions ?? '',
  };
  const modelInfo = providerStatus?.models.find((m) => m.id === config.model);
  const template = templates.data?.find((t) => t.id === config.templateId);
  const update = useCallback(<K extends keyof StudioConfig>(key: K, value: StudioConfig[K]) => {
    setCfg((c) => ({
      ...c,
      [key]: value,
      ...(key === 'provider' ? { model: undefined, temperature: undefined } : {}),
    }));
  }, []);

  const main = products[0];
  const compareIds = template?.requires.includes('compareProducts')
    ? products.slice(1, 3).map((p) => p.id)
    : [];
  const request: ScriptGenerateRequest | null =
    main && config.provider
      ? {
          productId: main.id,
          compareProductIds: compareIds,
          templateId: config.templateId,
          durationSeconds: config.durationSeconds,
          audienceId: config.audienceId as ScriptGenerateRequest['audienceId'],
          toneId: config.toneId as ScriptGenerateRequest['toneId'],
          hookStyleId: config.hookStyleId as ScriptGenerateRequest['hookStyleId'],
          ctaStyleId: config.ctaStyleId as ScriptGenerateRequest['ctaStyleId'],
          customInstructions: config.customInstructions.trim(),
          includePrice: config.includePrice,
          variantCount: config.variantCount,
          provider: config.provider,
          ...(config.model ? { model: config.model } : {}),
          ...(modelInfo?.supportsTemperature && config.temperature !== null
            ? { temperature: config.temperature }
            : {}),
        }
      : null;
  const ready = providerStatus?.status === 'ready';
  const requestKey = useDebouncedValue(request && ready ? JSON.stringify(request) : '', 400);
  const estimate = useAsync(
    () => (requestKey ? scriptRepository.estimate(JSON.parse(requestKey)) : Promise.resolve(null)),
    [requestKey],
  );

  // ---------------------------------------------------------------- mở / sửa kịch bản
  const showDetail = useCallback((detail: ScriptDetail) => {
    setOpen({ saved: detail, sample: false, doc: detail.document, dirty: false });
  }, []);

  const openScript = useCallback(
    async (id: string, opts: { loadGroup?: boolean } = {}) => {
      setBusy('open');
      try {
        const detail = await scriptRepository.get(id);
        showDetail(detail);
        if (opts.loadGroup) {
          setVariants(
            detail.variantGroupId
              ? await scriptRepository.list({ variantGroupId: detail.variantGroupId })
              : [],
          );
          setGeneration({ status: 'idle' });
        }
      } catch (error) {
        toast.error('Không mở được kịch bản', { description: describeError(error) });
      } finally {
        setBusy(null);
      }
    },
    [showDetail],
  );

  // Mở sẵn kịch bản từ URL (?script=id) – một lần, không gọi AI
  useEffect(() => {
    if (!initialScriptId) return;
    let active = true;
    scriptRepository
      .get(initialScriptId)
      .then(async (detail) => {
        const group = detail.variantGroupId
          ? await scriptRepository.list({ variantGroupId: detail.variantGroupId })
          : [];
        if (!active) return;
        showDetail(detail);
        setVariants(group);
      })
      .catch((error: unknown) => {
        if (active) toast.error('Không mở được kịch bản', { description: describeError(error) });
      });
    return () => {
      active = false;
    };
  }, [initialScriptId, showDetail]);

  const setDoc = useCallback((doc: ScriptDocument) => {
    setOpen((cur) => (cur ? { ...cur, doc: normalizeScriptDocument(doc), dirty: true } : cur));
  }, []);

  const discard = useCallback(() => {
    setOpen((cur) =>
      cur?.saved ? { ...cur, doc: cur.saved.document, dirty: false } : cur?.sample ? null : cur,
    );
  }, []);

  const startSample = useCallback(() => {
    setOpen({
      saved: null,
      sample: true,
      doc: buildSampleScript(main?.name ?? 'Sản phẩm', config.durationSeconds),
      dirty: true,
    });
    setVariants([]);
    setGeneration({ status: 'idle' });
  }, [main, config.durationSeconds]);

  const afterSave = (detail: ScriptDetail, message: string) => {
    showDetail(detail);
    setVariants((list) => list.map((v) => (v.rootId === detail.rootId ? detail : v)));
    saved.reload();
    toast.success(message);
  };

  const save = async () => {
    if (!open) return;
    setBusy('save');
    try {
      if (!open.saved) {
        const detail = await scriptRepository.createManual({
          productId: main?.id ?? null,
          document: open.doc,
          origin: open.sample ? 'sample' : 'manual',
        });
        afterSave(detail, 'Đã lưu kịch bản vào database');
      } else {
        afterSave(
          await scriptRepository.update(open.saved.id, open.doc),
          `Đã lưu phiên bản ${open.saved.versionNumber}`,
        );
      }
    } catch (error) {
      toast.error('Không lưu được kịch bản', { description: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const saveAsVersion = async () => {
    if (!open?.saved) return;
    setBusy('version');
    try {
      const detail = await scriptRepository.saveVersion(open.saved.id, open.doc);
      afterSave(detail, `Đã lưu thành phiên bản ${detail.versionNumber} (bản cũ giữ nguyên)`);
    } catch (error) {
      toast.error('Không lưu được phiên bản mới', { description: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  // ---------------------------------------------------------------- gọi AI
  const generate = async () => {
    if (!request) return;
    setGeneration({ status: 'generating', startedAt: Date.now(), count: request.variantCount });
    try {
      const result = await scriptRepository.generate(request);
      setGeneration({ status: 'done', result });
      const ok = result.items.flatMap((i) => (i.script ? [i.script] : []));
      setVariants(ok);
      if (ok[0]) await openScript(ok[0].id);
      saved.reload();
      if (result.failed)
        toast.warning(`Tạo được ${result.succeeded}/${result.requested} phiên bản`, {
          description: 'Các phiên bản lỗi được ghi rõ trong bảng so sánh.',
        });
      else toast.success(`Đã tạo và lưu ${result.succeeded} phiên bản kịch bản`);
    } catch (error) {
      const code = (error as { code?: string }).code;
      setGeneration({ status: 'failed', message: describeError(error), code });
      toast.error('Tạo kịch bản thất bại', { description: describeError(error) });
    }
  };

  const regenerate = async (kind: 'scene' | 'caption', sceneIndex?: number, instructions = '') => {
    if (!open?.saved) return;
    if (open.dirty) {
      toast.warning('Hãy lưu thay đổi trước khi tạo lại bằng AI', {
        description: 'AI tạo lại dựa trên phiên bản đã lưu và tạo ra phiên bản mới.',
      });
      return;
    }
    setBusy(kind === 'scene' ? `scene-${sceneIndex}` : 'caption');
    try {
      const detail =
        kind === 'scene'
          ? await scriptRepository.regenerateScene(open.saved.id, sceneIndex!, instructions)
          : await scriptRepository.regenerateCaption(open.saved.id, instructions);
      afterSave(
        detail,
        kind === 'scene'
          ? `Đã tạo lại cảnh ${sceneIndex} – lưu thành phiên bản ${detail.versionNumber}`
          : `Đã tạo lại caption – lưu thành phiên bản ${detail.versionNumber}`,
      );
    } catch (error) {
      toast.error('Tạo lại thất bại', { description: describeError(error) });
    } finally {
      setBusy(null);
    }
  };

  const setPreferred = useCallback(async (id: string) => {
    try {
      const detail = await scriptRepository.setPreferred(id);
      setVariants((list) =>
        list.map((v) =>
          v.variantGroupId === detail.variantGroupId
            ? { ...v, isPreferred: v.id === detail.id }
            : v,
        ),
      );
      setOpen((cur) => (cur?.saved?.id === detail.id ? { ...cur, saved: detail } : cur));
      toast.success('Đã chọn làm phiên bản tốt nhất');
    } catch (error) {
      toast.error('Không cập nhật được', { description: describeError(error) });
    }
  }, []);

  const remove = async () => {
    if (!open?.saved) return;
    try {
      const res = await scriptRepository.remove(open.saved.id);
      toast.success(`Đã xoá kịch bản (${res.deleted} phiên bản)`);
      const rootId = open.saved.rootId;
      setVariants((list) => list.filter((v) => v.rootId !== rootId));
      setOpen(null);
      saved.reload();
    } catch (error) {
      toast.error('Không xoá được', { description: describeError(error) });
    }
  };

  return {
    templates,
    providers,
    prefs,
    saved,
    products,
    setProducts,
    config,
    update,
    template,
    providerStatus,
    modelInfo,
    allowedCounts,
    request,
    ready,
    estimate,
    generation,
    variants,
    open,
    busy,
    openScript,
    setDoc,
    discard,
    startSample,
    save,
    saveAsVersion,
    generate,
    regenerate,
    setPreferred,
    remove,
    speechSpeed: prefs?.voice.speed ?? 1,
  };
}

export type ScriptStudioState = ReturnType<typeof useScriptStudio>;
