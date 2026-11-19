import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { ProductDetailView } from '@/components/products/product-detail-view';

export const metadata: Metadata = { title: 'Chi tiết sản phẩm' };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageContainer>
      <ProductDetailView id={id} />
    </PageContainer>
  );
}
