import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/common';
import { VideoFactoryView } from '@/components/videos/video-factory-view';

export const metadata: Metadata = { title: 'Xưởng video' };

export default function VideoFactoryPage() {
  return (
    // useSearchParams (?products=) cần Suspense boundary
    <Suspense fallback={<LoadingState variant="block" className="p-6" />}>
      <VideoFactoryView />
    </Suspense>
  );
}
