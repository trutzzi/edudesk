import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { AdminOverview } from './AdminOverview';
import { SystemHealth } from './health/SystemHealth';
import { StatsGrid } from './StatsGrid';

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
