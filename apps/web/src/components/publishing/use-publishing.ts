'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PublishMode, PublishingDraft, PublishingDraftInput } from '@acs/shared';
import { useAsync } from '@/hooks/use-async';
import { publishingDraftRepository, videoDraftRepository } from '@/lib/data';
import { parseHashtags } from '@/lib/format';
import { computeSchedule } from './schedule';

export interface PublishConfig {
  videoIds: string[];
  mode: PublishMode;
  caption: string;
  hashtags: string;
  startLocal: string;
  intervalMinutes: number;
}

const DEFAULT_CONFIG: PublishConfig = {
  videoIds: [],
  mode: 'scheduled',
  caption: '{product} – ưu đãi hôm nay, số lượng có hạn! 🔥',
  hashtags: '#xuhuong #review #fyp',
  startLocal: '',
  intervalMinutes: 60,
};

/**
 * State trang Lịch đăng TikTok.
 * - Bài đăng là BẢN NHÁP LƯU DATABASE (trạng thái "Chờ kiểm duyệt"), KHÔNG gửi TikTok (Phase 08).
 * - Video nguồn = luồng sản xuất nháp của Video Factory (chưa render).
 */
export function usePublishing() {
  const [config, setConfig] = useState<PublishConfig>(DEFAULT_CONFIG);
  const posts = useAsync(() => publishingDraftRepository.list(), []);
  const videos = useAsync(() => videoDraftRepository.list(), []);
  const [creating, setCreating] = useState(false);

  const update = useCallback(<K extends keyof PublishConfig>(key: K, value: PublishConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  const hashtags = useMemo(() => parseHashtags(config.hashtags), [config.hashtags]);
  const videoList = useMemo(() => videos.data ?? [], [videos.data]);

  const createDrafts = useCallback(async (): Promise<number> => {
    const chosen = videoList.filter((v) => config.videoIds.includes(v.id));
    const now = new Date().toISOString();
    const times =
      config.mode === 'scheduled'
        ? computeSchedule({
            startLocal: config.startLocal,
            intervalMinutes: config.intervalMinutes,
            count: chosen.length,
          })
        : chosen.map(() => now);
    const inputs: PublishingDraftInput[] = chosen.map((v, i) => ({
      videoDraftId: v.id,
      accountRef: null,
      caption: config.caption.replaceAll('{product}', v.productName),
      hashtags,
      mode: config.mode,
      scheduledAt: times[i]!,
      attachCart: false,
    }));
    setCreating(true);
    try {
      const created = await publishingDraftRepository.create(inputs);
      posts.reload();
      return created.length;
    } finally {
      setCreating(false);
    }
  }, [config, hashtags, videoList, posts]);

  const updateDraft = useCallback(
    async (
      post: PublishingDraft,
      patch: { caption: string; hashtags: string[]; scheduledAt: string },
    ) => {
      await publishingDraftRepository.update(post.id, patch);
      posts.reload();
    },
    [posts],
  );

  const removeDrafts = useCallback(
    async (ids: readonly string[]) => {
      await publishingDraftRepository.removeMany([...ids]);
      posts.reload();
    },
    [posts],
  );

  return {
    config,
    update,
    hashtags,
    videos: videoList,
    videosLoading: videos.loading && !videos.data,
    posts: posts.data ?? [],
    postsLoading: posts.loading && !posts.data,
    postsError: posts.error,
    reloadPosts: posts.reload,
    creating,
    createDrafts,
    updateDraft,
    removeDrafts,
  };
}

export type PublishingState = ReturnType<typeof usePublishing>;
