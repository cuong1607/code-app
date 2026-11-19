import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoadingState } from '@/components/common';
import { PageContainer } from '@/components/layout/page-container';
import { ProductsView } from '@/components/products/products-view';

export const metadata: Metadata = { title: 'Sản phẩm' };

export default function ProductsPage() {
  return (
    <PageContainer>
      {/* useSearchParams cần Suspense boundary */}
      <Suspense fallback={<LoadingState />}>
        <ProductsView />
      </Suspense>
    </PageContainer>
  );
}
