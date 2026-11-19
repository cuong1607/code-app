import type { Metadata } from 'next';
import { PublishingView } from '@/components/publishing/publishing-view';

export const metadata: Metadata = { title: 'Lịch đăng TikTok' };

export default function PublishingPage() {
  return <PublishingView />;
}
