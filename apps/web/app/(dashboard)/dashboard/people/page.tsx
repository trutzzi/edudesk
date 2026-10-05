import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { People } from '@/features/people/People';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('People');
  return { title: t('title') };
}

export default async function PeoplePage() {
  const t = await getTranslations('People');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <People />
    </>
  );
}
