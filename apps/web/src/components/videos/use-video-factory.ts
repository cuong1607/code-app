'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Product, VideoDraftInput } from '@acs/shared';
import { useAsync } from '@/hooks/use-async';
import { describeError } from '@/lib/api/client';
import {
  DEFAULT_VIDEO_PROMPT,
  VIDEO_PROMPT_TEMPLATES,
  VIDEO_TEMPLATES,
  VOICES,
  mediaRepository,
  productRepository,
  scriptRepository,
  videoDraftRepository,
} from '@/lib/data';
import { formatMoney } from '@/lib/format';
import type { FactoryConfig, ReferenceImage, SelectedProduct } from './factory-types';

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

/** Điền biến trong prompt bằng dữ liệu sản phẩm thật. */
export function renderPrompt(template: string, product: Product, durationSec: number): string {
  return template
    .replaceAll('{product}', product.name)
    .replaceAll('{price}', formatMoney(product.sellingPrice, product.currency))
    .replaceAll('{duration}', String(durationSec))
    .replaceAll('{category}', product.category);
}

function batchKeyNow(): string {
  const d = new Date(Date.now() + 7 * 3600_000).toISOString(); // giờ VN cho dễ đọc
  return `batch-${d.slice(0, 10).replaceAll('-', '')}-${d.slice(11, 16).replace(':', '')}`;
}

/**
 * State của Video Factory.
 * - Luồng sản xuất là BẢN NHÁP LƯU TRONG POSTGRESQL (API /drafts/video). Chưa render (Phase 06/07).
 * - Sản phẩm & ảnh lấy từ API thật.
 */
export function useVideoFactory(
  initialProductIds: string[] = [],
  initialScriptId: string | null = null,
  /** Ảnh (đã duyệt) từ Image Studio (?images=) – đặt lên đầu ảnh của sản phẩm đầu tiên */
  initialImageIds: string[] = [],
) {
  const [config, setConfig] = useState<FactoryConfig>(DEFAULT_CONFIG);
  /** Kịch bản (phiên bản cụ thể) dùng làm đầu vào – chọn từ trang Kịch bản AI (?script=id) */
  const [scriptId, setScriptId] = useState<string | null>(initialScriptId);
  const script = useAsync(
    () => (scriptId ? scriptRepository.get(scriptId) : Promise.resolve(null)),
    [scriptId ?? ''],
  );
  const [selected, setSelected] = useState<SelectedProduct[]>([]);
  const drafts = useAsync(() => videoDraftRepository.list(), []);
  const [creating, setCreating] = useState(false);

  const update = useCallback(<K extends keyof FactoryConfig>(key: K, value: FactoryConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  /** Ảnh chọn sẵn từ Image Studio, theo sản phẩm (chỉ đọc trong callback, không trong render) */
  const extraImagesRef = useRef<Map<string, ReferenceImage[]>>(new Map());

  /** Nạp ảnh thật của sản phẩm (trang chi tiết) cho các sản phẩm vừa chọn. */
  const loadImages = useCallback(async (products: Product[]) => {
    for (const product of products) {
      try {
        const detail = await productRepository.get(product.id);
        const extra = extraImagesRef.current.get(product.id) ?? [];
        const images: ReferenceImage[] = [
          ...extra,
          ...detail.media
            .filter((m) => !extra.some((e) => e.id === m.mediaAssetId))
            .map((m) => ({
              id: m.mediaAssetId,
              previewUrl: m.asset.previewUrl,
              filename: m.asset.filename,
            })),
        ];
        const primary =
          extra[0]?.id ?? detail.media.find((m) => m.isPrimary)?.mediaAssetId ?? images[0]?.id;
        setSelected((prev) =>
          prev.map((s) =>
            s.product.id === product.id
              ? { ...s, images: images.slice(0, 8), primaryImageId: primary, loadingImages: false }
              : s,
          ),
        );
      } catch {
        setSelected((prev) =>
          prev.map((s) => (s.product.id === product.id ? { ...s, loadingImages: false } : s)),
        );
      }
    }
  }, []);

  // Bản sao mới nhất của `selected` để tính sản phẩm mới mà không gây side effect trong updater
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const setProducts = useCallback(
    (products: Product[]) => {
      const fresh = products.filter((p) => !selectedRef.current.some((s) => s.product.id === p.id));
      setSelected((prev) =>
        products.map(
          (product) =>
            prev.find((s) => s.product.id === product.id) ?? {
              product,
              images: [],
              loadingImages: true,
            },
        ),
      );
      void loadImages(fresh);
    },
    [loadImages],
  );

  // Chọn sẵn sản phẩm khi đi từ trang Sản phẩm (?products=id1,id2)
  const initialRef = useRef(initialProductIds);
  const initialImagesRef = useRef(initialImageIds);
  useEffect(() => {
    const ids = initialRef.current;
    if (!ids.length) return;
    let active = true;
    const imageIds = initialImagesRef.current.slice(0, 20);
    Promise.all([
      Promise.allSettled(ids.slice(0, 50).map((id) => productRepository.get(id))),
      Promise.allSettled(imageIds.map((id) => mediaRepository.get(id))),
    ]).then(([results, images]) => {
      if (!active) return;
      const products = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const extra = images.flatMap((r) =>
        r.status === 'fulfilled'
          ? [{ id: r.value.id, previewUrl: r.value.previewUrl, filename: r.value.filename }]
          : [],
      );
      if (products[0] && extra.length) extraImagesRef.current.set(products[0].id, extra);
      if (products.length) setProducts(products);
    });
    return () => {
      active = false;
    };
  }, [setProducts]);

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

  const addImages = useCallback((productId: string, images: ReferenceImage[]) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.product.id === productId
          ? {
              ...s,
              images: [...s.images, ...images.filter((i) => !s.images.some((x) => x.id === i.id))],
              primaryImageId: s.primaryImageId ?? images[0]?.id,
            }
          : s,
      ),
    );
  }, []);

  const totalVideos = selected.length * config.versionsPerProduct;

  /** Lưu các luồng sản xuất NHÁP vào database (chưa chạy). Trả về số luồng đã tạo. */
  const createDrafts = useCallback(async (): Promise<number> => {
    const batchKey = batchKeyNow();
    const inputs: VideoDraftInput[] = selected.flatMap(({ product, images, primaryImageId }) => {
      const ordered = [...images].sort(
        (a, b) => Number(b.id === primaryImageId) - Number(a.id === primaryImageId),
      );
      return Array.from({ length: config.versionsPerProduct }, (_, v) => ({
        name: `${product.name} · bản ${v + 1}`,
        batchKey,
        productId: product.id,
        prompt: renderPrompt(config.prompt, product, config.durationSec),
        config: {
          aspectRatio: config.aspectRatio,
          durationSec: config.durationSec,
          quality: config.quality,
          mode: config.mode,
          voiceId: config.voiceId,
          templateId: config.templateId,
        },
        mediaAssetIds: ordered.map((i) => i.id),
        // Gắn kịch bản cho đúng sản phẩm của kịch bản đó
        scriptId: script.data && script.data.productId === product.id ? script.data.id : null,
      }));
    });
    setCreating(true);
    try {
      const created = await videoDraftRepository.create(inputs);
      drafts.reload();
      return created.length;
    } catch (error) {
      throw new Error(describeError(error));
    } finally {
      setCreating(false);
    }
  }, [selected, config, drafts, script.data]);

  const removeDrafts = useCallback(
    async (ids: readonly string[]) => {
      await videoDraftRepository.removeMany([...ids]);
      drafts.reload();
    },
    [drafts],
  );

  return {
    config,
    update,
    setConfig,
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
    creating,
    createDrafts,
    removeDrafts,
    drafts: drafts.data ?? [],
    draftsLoading: drafts.loading && !drafts.data,
    draftsError: drafts.error,
    reloadDrafts: drafts.reload,
    script: script.data ?? null,
    scriptError: script.error,
    clearScript: () => setScriptId(null),
  };
}

export type VideoFactoryState = ReturnType<typeof useVideoFactory>;
