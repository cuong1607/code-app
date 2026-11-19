import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { ScriptStudioView } from '@/components/scripts/script-studio-view';

export const metadata: Metadata = { title: 'Kịch bản AI' };

export default function ScriptStudioPage() {
  return (
    <PageContainer>
      <ScriptStudioView />
    </PageContainer>
  );
}
