'use client';

import { useCallback, useMemo, useState } from 'react';
import { useAsync } from '@/hooks/use-async';
import {
  DEFAULT_VIDEO_PROMPT,
  VIDEO_PROMPT_TEMPLATES,
  VIDEO_TEMPLATES,
  VOICES,
  videoJobRepository,
} from '@/lib/data';
import type { ImageRef, Product, VideoJob } from '@/types/domain';
import type { FactoryConfig, SelectedProduct } from './factory-types';

const DEFAULT_TEMPLATE = VIDEO_PROMPT_TEMPLATES.find((t) => t.content === DEFAULT_VIDEO_PROMPT)!;

export const DEFAULT_CONFIG: FactoryConfig = {
  prompt: DEFAULT_VIDEO_PROMPT,
  promptCategory: DEFAULT_TEMPLATE.categoryId,
  promptTemplateId: DEFAULT_TEMPLATE.id,
  aspectRatio: '9:16',
  durationSec: 30,
  quality: '1080p',
  mode: 'image_slideshow',
  voiceId: VOICES[0]!.id,
  templateId: VIDEO_TEMPLATES[0]!.id,
  concurrency: 2,
  versionsPerProduct: 2,
};

/**
 * State của Video Factory.
 * - Tác vụ DEMO lấy từ repository (chỉ đọc).
 * - "Tạo luồng sản xuất" sinh các dòng NHÁP CỤC BỘ (chưa gửi backend, chưa chạy).
 */
export function useVideoFactory() {
  const [config, setConfig] = useState<FactoryConfig>(DEFAULT_CONFIG);
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const [drafts, setDrafts] = useState<VideoJob[]>([]);
  const jobsQuery = useAsync(() => videoJobRepository.list(), []);

  const update = useCallback(<K extends keyof FactoryConfig>(key: K, value: FactoryConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  const setProducts = useCallback((products: Product[]) => {
    setSelected((prev) =>
      products.map(
        (product) =>
          prev.find((s) => s.product.id === product.id) ?? {
            product,
            images: product.images.slice(0, 4),
            primaryImageId: (product.images.find((i) => i.isPrimary) ?? product.images[0])?.id,
          },
      ),
    );
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setSelected((prev) => prev.filter((s) => s.product.id !== productId));
  }, []);

  const setPrimaryImage = useCallback((productId: string, imageId: string) => {
    setSelected((prev) =>
      prev.map((s) => (s.product.id === productId ? { ...s, primaryImageId: imageId } : s)),
    );
  }, []);

  const removeImage = useCallback((productId: string, imageId: string) => {
    setSelected((prev) =>
      prev.map((s) => {
        if (s.product.id !== productId) return s;
        const images = s.images.filter((i) => i.id !== imageId);
        return {
          ...s,
          images,
          primaryImageId: s.primaryImageId === imageId ? images[0]?.id : s.primaryImageId,
        };
      }),
    );
  }, []);

  const addImages = useCallback((productId: string, images: ImageRef[]) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.product.id === productId
          ? {
              ...s,
              images: [...s.images, ...images],
              primaryImageId: s.primaryImageId ?? images[0]?.id,
            }
          : s,
      ),
    );
  }, []);

  const totalVideos = selected.length * config.versionsPerProduct;

  /** Tạo các dòng nháp cục bộ – KHÔNG gửi lên server, KHÔNG chạy. */
  const createDrafts = useCallback((): number => {
    const batchId = `local-batch-${Date.now()}`;
    const now = new Date().toISOString();
    const created: VideoJob[] = selected.flatMap(({ product, images, primaryImageId }) => {
      const ordered = [...images].sort(
        (a, b) => Number(b.id === primaryImageId) - Number(a.id === primaryImageId),
      );
      return Array.from({ length: config.versionsPerProduct }, (_, v) => ({
        id: `local-job-${crypto.randomUUID()}`,
        name: `Nháp · ${product.name} · bản ${v + 1}`,
        batchId,
        productId: product.id,
        productName: product.name,
        prompt: config.prompt
          .replaceAll('{product}', product.name)
          .replaceAll('{duration}', String(config.durationSec)),
        images: ordered,
        aspectRatio: config.aspectRatio,
        durationSec: config.durationSec,
        quality: config.quality,
        mode: config.mode,
        voiceId: config.voiceId,
        templateId: config.templateId,
        status: 'queued' as const,
        progress: 0,
        createdAt: now,
        updatedAt: now,
        isDemo: false,
        isLocalDraft: true,
      }));
    });
    setDrafts((prev) => [...created, ...prev]);
    return created.length;
  }, [selected, config]);

  const removeDrafts = useCallback((ids: readonly string[]) => {
    const set = new Set(ids);
    setDrafts((prev) => prev.filter((d) => !set.has(d.id)));
  }, []);

  const jobs = useMemo(
    () => [...drafts, ...(jobsQuery.data?.items ?? [])],
    [drafts, jobsQuery.data],
  );

  return {
    config,
    update,
    resetPrompt: () =>
      setConfig((c) => ({
        ...c,
        prompt: DEFAULT_CONFIG.prompt,
        promptCategory: DEFAULT_CONFIG.promptCategory,
        promptTemplateId: DEFAULT_CONFIG.promptTemplateId,
      })),
    selected,
    setProducts,
    removeProduct,
    setPrimaryImage,
    removeImage,
    addImages,
    totalVideos,
    createDrafts,
    removeDrafts,
    drafts,
    jobs,
    jobsLoading: jobsQuery.loading,
    jobsError: jobsQuery.error,
    reloadJobs: jobsQuery.reload,
  };
}

export type VideoFactoryState = ReturnType<typeof useVideoFactory>;
