import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { PageContainer } from '@/components/layout/page-container';
import { SystemStatus } from '@/components/system-status';
import { fetchApiHealth } from '@/lib/api-health';

export const metadata: Metadata = { title: 'Tổng quan' };
// Trạng thái hệ thống là dữ liệu thật tại thời điểm xem
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const health = await fetchApiHealth();
  return (
    <PageContainer>
      <DashboardView systemStatus={<SystemStatus result={health} />} />
    </PageContainer>
  );
}
