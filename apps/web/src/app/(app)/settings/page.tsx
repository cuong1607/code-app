import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/common';
import { PageContainer } from '@/components/layout/page-container';
import { SettingsView } from '@/components/settings/settings-view';

export const metadata: Metadata = { title: 'Cài đặt' };

export default function SettingsPage() {
  return (
    <PageContainer>
      <Suspense fallback={<LoadingState variant="block" />}>
        <SettingsView />
      </Suspense>
    </PageContainer>
  );
}
