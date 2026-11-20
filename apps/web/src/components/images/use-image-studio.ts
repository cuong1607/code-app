'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  DEFAULT_IMAGE_ASPECT,
  IMAGE_JOB_ACTIVE_STATUSES,
  IMAGE_MODE_META,
  type ImageAspect,
  type ImageCount,
  type ImageGenerateRequestInput,
  type ImageItem,
  type ImageJobDetail,
  type ImageMode,
  type ImageProviderId,
  type Product,
} from '@acs/shared';
import { useAsync } from '@/hooks/use-async';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { describeError } from '@/lib/api/client';
import { type ImageReviewInputBody, imageRepository, settingsRepository } from '@/lib/data';

const POLL_MS = 2000;

export interface ImageStudioConfig {
  mode: ImageMode;
  templateId: string | null;
  styleId: string | null;
  aspect: ImageAspect;
  count: ImageCount;
  provider: ImageProviderId | null;
  model: string | null;
  userPrompt: string;
  backgroundColor: string;
}

const isActive = (job: ImageJobDetail | null) =>
  !!job && IMAGE_JOB_ACTIVE_STATUSES.includes(job.status);

/** Giữ previewUrl cũ khi ảnh không đổi (URL ký lại mỗi lần đọc -> tránh ảnh nhấp nháy khi polling). */
function mergeJob(prev: ImageJobDetail | null, next: ImageJobDetail): ImageJobDetail {
  if (!prev || prev.id !== next.id) return next;
  const old = new Map(prev.items.map((i) => [i.id, i]));
  return {
    ...next,
    items: next.items.map((i) => {
      const o = old.get(i.id);
      return o?.asset && i.asset && o.asset.id === i.asset.id
        ? { ...i, asset: { ...i.asset, previewUrl: o.asset.previewUrl } }
        : i;
    }),
    references: next.references.map((r) => prev.references.find((p) => p.id === r.id) ?? r),
  };
}

/**
 * State của AI Image Studio.
 *  - CHỈ gọi AI khi bấm "Tạo ảnh"/"Tạo lại". Đổi tab, mở tác vụ cũ, xem ảnh KHÔNG gọi AI.
 *  - Ước tính chi phí (/images/estimate) không gọi AI, có debounce.
 *  - idempotencyKey sinh khi bấm nút; thử lại với cùng cấu hình dùng lại khoá cũ -> không tạo trùng.
 *  - Tiến độ: polling 2 giây khi tác vụ đang chạy, hiển thị giai đoạn (không có % giả).
 */
export function useImageStudio() {
  const catalog = useAsync(() => imageRepository.catalog(), []);
  const providers = useAsync(() => imageRepository.providers(), []);
  const settings = useAsync(() => settingsRepository.get(), []);
  const prefs = settings.data?.preferences;

  const [product, setProduct] = useState<Product | null>(null);
  const [cfg, setCfg] = useState<Partial<ImageStudioConfig>>({});
  const [pickedRefs, setPickedRefs] = useState<string[] | null>(null);
  const [job, setJob] = useState<ImageJobDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  const mode: ImageMode = cfg.mode ?? 'lifestyle_interior';
  const context = useAsync(
    () => (product ? imageRepository.productContext(product.id, mode) : Promise.resolve(null)),
    [product?.id ?? '', mode],
  );
  const ctx =
    context.data && context.data.visualContext.productId === product?.id ? context.data : null;
  const jobs = useAsync(() => imageRepository.listJobs({ pageSize: 20 }), []);

  // ---------------------------------------------------------------- cấu hình suy ra
  const usesAi = IMAGE_MODE_META[mode].usesAi;
  const applicable = ctx?.templates.filter((m) => m.applicable) ?? [];
  const templateId =
    cfg.templateId && applicable.some((m) => m.template.id === cfg.templateId)
      ? cfg.templateId
      : ((applicable.find((m) => m.recommended) ?? applicable[0])?.template.id ?? null);
  const template = applicable.find((m) => m.template.id === templateId)?.template ?? null;
  const providerId = usesAi ? (cfg.provider ?? providers.data?.defaultProvider ?? null) : null;
  const providerStatus = providers.data?.providers.find((p) => p.id === providerId);
  const config: ImageStudioConfig = {
    mode,
    templateId,
    styleId: cfg.styleId ?? template?.defaultStyleId ?? null,
    aspect: cfg.aspect ?? prefs?.images.defaultAspect ?? DEFAULT_IMAGE_ASPECT,
    count: usesAi ? (cfg.count ?? (mode === 'batch_variations' ? 3 : 1)) : 1,
    provider: providerId,
    model: cfg.model ?? providerStatus?.defaultModel ?? null,
    userPrompt: cfg.userPrompt ?? '',
    backgroundColor: cfg.backgroundColor ?? '#F4F1EC',
  };
  const modelInfo = providerStatus?.models.find((m) => m.id === config.model);
  const maxRefs = usesAi ? (modelInfo?.maxReferenceImages ?? 1) : 1;
  const references = ctx?.references ?? [];
  const refIds = (pickedRefs ?? references.slice(0, 1).map((r) => r.id))
    .filter((id) => references.some((r) => r.id === id))
    .slice(0, maxRefs);

  const update = useCallback(
    <K extends keyof ImageStudioConfig>(key: K, value: ImageStudioConfig[K]) => {
      setCfg((c) => ({
        ...c,
        [key]: value,
        ...(key === 'provider' ? { model: undefined } : {}),
        ...(key === 'mode' ? { count: undefined } : {}),
        ...(key === 'templateId' ? { styleId: undefined } : {}),
      }));
    },
    [],
  );

  const chooseProduct = useCallback((p: Product | null) => {
    setProduct(p);
    setPickedRefs(null);
  }, []);

  const toggleRef = useCallback(
    (id: string) => {
      setPickedRefs((cur) => {
        const base = cur ?? refIds;
        return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      });
    },
    [refIds],
  );

  const ready = !usesAi || providerStatus?.status === 'ready';
  const request: Omit<ImageGenerateRequestInput, 'idempotencyKey'> | null =
    product && templateId && refIds.length && ready
      ? {
          productId: product.id,
          referenceAssetIds: refIds,
          mode,
          templateId,
          styleId: config.styleId,
          aspect: config.aspect,
          count: config.count,
          ...(usesAi
            ? {
                provider: config.provider,
                model: config.model,
                userPrompt: config.userPrompt.trim() || null,
              }
            : { backgroundColor: config.backgroundColor }),
        }
      : null;
  const requestSig = request ? JSON.stringify(request) : '';
  const debounced = useDebouncedValue(requestSig, 400);
  const estimate = useAsync(
    () => (debounced ? imageRepository.estimate(JSON.parse(debounced)) : Promise.resolve(null)),
    [debounced],
  );
  const estimateFresh =
    estimate.data && debounced === requestSig && !estimate.loading ? estimate.data : null;

  // ---------------------------------------------------------------- tác vụ
  const openJob = useCallback(async (id: string) => {
    setBusy('open');
    try {
      const detail = await imageRepository.getJob(id);
      setJob(detail);
    } catch (error) {
      toast.error('Không mở được tác vụ', { description: describeError(error) });
    } finally {
      setBusy(null);
    }
  }, []);

  // Polling khi tác vụ còn chạy (setState trong callback hẹn giờ – không đồng bộ trong effect)
  const jobsReload = jobs.reload;
  useEffect(() => {
    if (!job || !isActive(job)) return;
    const id = job.id;
    const t = setTimeout(() => {
      imageRepository
        .getJob(id)
        .then((next) => {
          setJob((prev) => (prev?.id === id ? mergeJob(prev, next) : prev));
          if (!isActive(next)) jobsReload();
        })
        .catch(() => {
          // Lỗi mạng tạm thời: thử lại ở lượt sau bằng cách đặt lại cùng dữ liệu
          setJob((prev) => (prev?.id === id ? { ...prev } : prev));
        });
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [job, jobsReload]);

  const jobsReloadFn = jobs.reload;
  const generate = useCallback(async () => {
    if (!requestSig) return;
    const req = JSON.parse(requestSig) as Omit<ImageGenerateRequestInput, 'idempotencyKey'>;
    // Cùng cấu hình (vd thử lại sau lỗi mạng) -> cùng khoá -> server trả tác vụ cũ
    if (keyRef.current?.sig !== requestSig) {
      keyRef.current = { sig: requestSig, key: crypto.randomUUID() };
    }
    setBusy('generate');
    try {
      const created = await imageRepository.createJob({
        ...req,
        idempotencyKey: keyRef.current.key,
      });
      keyRef.current = null;
      setJob(created);
      jobsReloadFn();
      toast.success(
        usesAi
          ? `Đã xếp hàng ${created.requestedCount} ảnh – đang xử lý nền`
          : 'Đã xếp hàng ghép ảnh gốc',
      );
    } catch (error) {
      toast.error('Không tạo được tác vụ ảnh', { description: describeError(error) });
    } finally {
      setBusy(null);
    }
  }, [requestSig, usesAi, jobsReloadFn]);

  const replaceItem = useCallback((item: ImageItem) => {
    setJob((prev) =>
      prev && prev.id === item.jobId
        ? {
            ...prev,
            items: prev.items.map((i) => (i.id === item.id ? item : i)),
            counts: {
              ...prev.counts,
              approved: prev.items.filter(
                (i) => (i.id === item.id ? item : i).approvalStatus === 'approved',
              ).length,
              rejected: prev.items.filter(
                (i) => (i.id === item.id ? item : i).approvalStatus === 'rejected',
              ).length,
            },
          }
        : prev,
    );
  }, []);

  const act = useCallback(
    async <T>(label: string, fn: () => Promise<T>, ok: string): Promise<T | null> => {
      setBusy(label);
      try {
        const r = await fn();
        toast.success(ok);
        return r;
      } catch (error) {
        toast.error('Thao tác thất bại', { description: describeError(error) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const approve = useCallback(
    async (itemId: string, input?: ImageReviewInputBody) => {
      const r = await act(
        `approve:${itemId}`,
        () => imageRepository.approve(itemId, input),
        'Đã duyệt ảnh',
      );
      if (r) replaceItem(r);
      return r;
    },
    [act, replaceItem],
  );
  const reject = useCallback(
    async (itemId: string, input?: ImageReviewInputBody) => {
      const r = await act(
        `reject:${itemId}`,
        () => imageRepository.reject(itemId, input),
        'Đã từ chối ảnh',
      );
      if (r) replaceItem(r);
      return r;
    },
    [act, replaceItem],
  );
  const save = useCallback(
    async (itemId: string) => {
      const r = await act(
        `save:${itemId}`,
        () => imageRepository.saveToLibrary(itemId),
        'Đã lưu vào thư viện media',
      );
      if (r) replaceItem(r);
    },
    [act, replaceItem],
  );
  const link = useCallback(
    async (itemId: string) => {
      const r = await act(
        `link:${itemId}`,
        () => imageRepository.linkToProduct(itemId),
        'Đã gắn ảnh vào sản phẩm',
      );
      if (r) replaceItem(r);
    },
    [act, replaceItem],
  );
  const regenerate = useCallback(
    async (itemId: string) => {
      const r = await act(
        `regen:${itemId}`,
        () => imageRepository.regenerate(itemId),
        'Đã xếp hàng tạo lại ảnh',
      );
      if (r) setJob(r);
    },
    [act],
  );
  const cancel = useCallback(async () => {
    if (!job) return;
    const r = await act('cancel', () => imageRepository.cancelJob(job.id), 'Đã huỷ tác vụ');
    if (r) {
      setJob(r);
      jobs.reload();
    }
  }, [act, job, jobs]);
  const removeJob = useCallback(async () => {
    if (!job) return;
    const r = await act('remove', () => imageRepository.removeJob(job.id), 'Đã xoá tác vụ');
    if (r) {
      setJob(null);
      jobs.reload();
    }
  }, [act, job, jobs]);
  const download = useCallback(async (itemId: string) => {
    try {
      const { url } = await imageRepository.downloadUrl(itemId);
      window.location.assign(url);
    } catch (error) {
      toast.error('Không tải được ảnh', { description: describeError(error) });
    }
  }, []);

  return {
    catalog: catalog.data,
    catalogError: catalog.error,
    providers: providers.data,
    providersError: providers.error,
    requireApproval: prefs?.images.requireApprovalForVideo ?? true,
    product,
    chooseProduct,
    context: ctx,
    contextLoading: context.loading && !!product,
    contextError: context.error,
    references,
    refIds,
    maxRefs,
    toggleRef,
    config,
    update,
    usesAi,
    template,
    providerStatus,
    modelInfo,
    estimate: estimateFresh,
    estimateLoading: !!requestSig && (estimate.loading || debounced !== requestSig),
    estimateError: estimate.error,
    canGenerate: !!request && !!estimateFresh?.allowed && busy !== 'generate',
    generate,
    busy,
    job,
    openJob,
    closeJob: () => setJob(null),
    jobs: jobs.data?.items ?? [],
    jobsLoading: jobs.loading && !jobs.data,
    jobsError: jobs.error,
    reloadJobs: jobs.reload,
    approve,
    reject,
    save,
    link,
    regenerate,
    cancel,
    removeJob,
    download,
  };
}

export type ImageStudioState = ReturnType<typeof useImageStudio>;
