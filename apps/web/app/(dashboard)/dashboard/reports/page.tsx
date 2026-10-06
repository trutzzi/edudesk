import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Reports } from '@/features/sessions/Reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Reports');
  return { title: t('title') };
}

export default async function ReportsPage() {
  const t = await getTranslations('Reports');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Reports />
    </>
  );
}
