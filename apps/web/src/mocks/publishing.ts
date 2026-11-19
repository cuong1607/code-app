/** DỮ LIỆU DEMO – lịch đăng TikTok. KHÔNG có bài đăng thật nào. */
import type { PublishStatus } from '@acs/shared';
import type { PublishPost } from '@/types/domain';
import { TIKTOK_ACCOUNTS } from './catalog';
import { DEMO_VIDEO_JOBS } from './video-jobs';
import { minutesAgo, minutesAhead } from './rng';

const PLAN: { status: PublishStatus; offsetMin: number }[] = [
  { status: 'published', offsetMin: -2880 },
  { status: 'published', offsetMin: -1500 },
  { status: 'failed', offsetMin: -600 },
  { status: 'processing', offsetMin: -5 },
  { status: 'scheduled', offsetMin: 120 },
  { status: 'scheduled', offsetMin: 300 },
  { status: 'scheduled', offsetMin: 1440 },
  { status: 'pending_review', offsetMin: 1680 },
  { status: 'pending_review', offsetMin: 2880 },
  { status: 'scheduled', offsetMin: 3000 },
  { status: 'pending_review', offsetMin: 4320 },
  { status: 'published', offsetMin: -4320 },
];

export const DEMO_PUBLISH_POSTS: PublishPost[] = PLAN.map((plan, index) => {
  const job = DEMO_VIDEO_JOBS[index % DEMO_VIDEO_JOBS.length]!;
  const account = TIKTOK_ACCOUNTS[index % TIKTOK_ACCOUNTS.length]!;
  return {
    id: `demo-post-${index + 1}`,
    videoJobId: job.id,
    videoName: job.name,
    thumbnail: job.images[0] ?? { id: `demo-thumb-${index}`, hue: 30 },
    accountId: account.id,
    caption: `${job.productName} – ưu đãi hôm nay, số lượng có hạn! (caption DEMO)`,
    hashtags: ['#xuhuong', '#review', index % 2 ? '#sale' : '#fyp'],
    productLink: index % 3 === 0 ? `Giỏ hàng: ${job.productName}` : undefined,
    mode: plan.offsetMin < 0 && index % 4 === 0 ? 'immediate' : 'scheduled',
    scheduledAt: plan.offsetMin < 0 ? minutesAgo(-plan.offsetMin) : minutesAhead(plan.offsetMin),
    status: plan.status,
    errorMessage:
      plan.status === 'failed'
        ? 'DEMO: Phiên đăng nhập TikTok đã hết hạn, cần kết nối lại.'
        : undefined,
    isDemo: true,
  };
});
