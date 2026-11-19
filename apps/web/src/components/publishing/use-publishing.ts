'use client';

import { useCallback, useMemo, useState } from 'react';
import type { PublishMode } from '@acs/shared';
import { useAsync } from '@/hooks/use-async';
import { publishRepository, videoJobRepository } from '@/lib/data';
import { parseHashtags } from '@/lib/format';
import type { PublishPost, VideoJob } from '@/types/domain';
import { computeSchedule } from './schedule';

export interface PublishConfig {
  accountId: string;
  videoIds: string[];
  mode: PublishMode;
  caption: string;
  hashtags: string;
  startLocal: string;
  intervalMinutes: number;
  attachCart: boolean;
}

const DEFAULT_CONFIG: PublishConfig = {
  accountId: '',
  videoIds: [],
  mode: 'scheduled',
  caption: '{product} – ưu đãi hôm nay, số lượng có hạn! 🔥',
  hashtags: '#xuhuong #review #fyp',
  startLocal: '',
  intervalMinutes: 60,
  attachCart: false,
};

/**
 * State trang Lịch đăng TikTok.
 * - Bài đăng DEMO chỉ đọc.
 * - "Tạo lịch đăng" sinh bài NHÁP CỤC BỘ ở trạng thái "Chờ kiểm duyệt" – KHÔNG gửi TikTok.
 */
export function usePublishing() {
  const [config, setConfig] = useState<PublishConfig>(DEFAULT_CONFIG);
  const [drafts, setDrafts] = useState<PublishPost[]>([]);
  const postsQuery = useAsync(() => publishRepository.list(), []);
  const videosQuery = useAsync(() => videoJobRepository.list(), []);

  const update = useCallback(<K extends keyof PublishConfig>(key: K, value: PublishConfig[K]) => {
    setConfig((c) => ({ ...c, [key]: value }));
  }, []);

  /** Chỉ video đã hoàn thành mới đăng được. */
  const publishableVideos: VideoJob[] = useMemo(
    () => (videosQuery.data?.items ?? []).filter((v) => v.status === 'completed'),
    [videosQuery.data],
  );

  const hashtags = useMemo(() => parseHashtags(config.hashtags), [config.hashtags]);

  const createDrafts = useCallback((): number => {
    const videos = publishableVideos.filter((v) => config.videoIds.includes(v.id));
    const now = new Date().toISOString();
    const times =
      config.mode === 'scheduled'
        ? computeSchedule({
            startLocal: config.startLocal,
            intervalMinutes: config.intervalMinutes,
            count: videos.length,
          })
        : videos.map(() => now);
    const created: PublishPost[] = videos.map((video, i) => ({
      id: `local-post-${crypto.randomUUID()}`,
      videoJobId: video.id,
      videoName: video.name,
      thumbnail: video.thumbnail ?? video.images[0] ?? { id: `t-${video.id}`, hue: 30 },
      accountId: config.accountId,
      caption: config.caption.replaceAll('{product}', video.productName),
      hashtags,
      productLink: config.attachCart ? `Giỏ hàng: ${video.productName}` : undefined,
      mode: config.mode,
      scheduledAt: times[i]!,
      status: 'pending_review',
      isDemo: false,
      isLocalDraft: true,
    }));
    setDrafts((prev) => [...created, ...prev]);
    return created.length;
  }, [config, hashtags, publishableVideos]);

  const updateDraft = useCallback((post: PublishPost) => {
    setDrafts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
  }, []);

  const removeDrafts = useCallback((ids: readonly string[]) => {
    const set = new Set(ids);
    setDrafts((prev) => prev.filter((p) => !set.has(p.id)));
  }, []);

  const posts = useMemo(
    () =>
      [...drafts, ...(postsQuery.data?.items ?? [])].sort((a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt),
      ),
    [drafts, postsQuery.data],
  );

  return {
    config,
    update,
    hashtags,
    publishableVideos,
    videosLoading: videosQuery.loading,
    posts,
    postsLoading: postsQuery.loading,
    postsError: postsQuery.error,
    reloadPosts: postsQuery.reload,
    createDrafts,
    updateDraft,
    removeDrafts,
  };
}

export type PublishingState = ReturnType<typeof usePublishing>;
