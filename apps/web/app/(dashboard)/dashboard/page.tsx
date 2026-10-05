import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { SystemHealth } from '@/features/health/SystemHealth';
import { AdminOverview } from '@/features/overview/AdminOverview';
import { StatsGrid } from '@/features/overview/StatsGrid';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Common');
  return { title: t('dashboard') };
}

export default async function DashboardPage() {
  const t = await getTranslations('Dashboard');

  return (
    <AdminOverview>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <StatsGrid />
      <SystemHealth />
    </AdminOverview>
  );
}
