import type { Metadata } from 'next';
import { VideoFactoryView } from '@/components/videos/video-factory-view';

export const metadata: Metadata = { title: 'Xưởng video' };

export default function VideoFactoryPage() {
  return <VideoFactoryView />;
}
