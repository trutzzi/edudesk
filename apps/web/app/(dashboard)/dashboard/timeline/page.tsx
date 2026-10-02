import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Timeline } from './Timeline';
import { PageHeader } from '@/components/ui/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Timeline');
  return { title: t('title') };
}

export default async function TimelinePage() {
  const t = await getTranslations('Timeline');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Timeline />
    </>
  );
}
