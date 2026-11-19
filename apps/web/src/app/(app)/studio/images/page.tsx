import type { Metadata } from 'next';
import { ImageStudioView } from '@/components/images/image-studio-view';
import { PageContainer } from '@/components/layout/page-container';

export const metadata: Metadata = { title: 'Xưởng ảnh AI' };

export default function ImageStudioPage() {
  return (
    <PageContainer>
      <ImageStudioView />
    </PageContainer>
  );
}
