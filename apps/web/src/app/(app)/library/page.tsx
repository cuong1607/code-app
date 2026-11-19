import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { LibraryView } from '@/components/library/library-view';

export const metadata: Metadata = { title: 'Thư viện' };

export default function LibraryPage() {
  return (
    <PageContainer>
      <LibraryView />
    </PageContainer>
  );
}
