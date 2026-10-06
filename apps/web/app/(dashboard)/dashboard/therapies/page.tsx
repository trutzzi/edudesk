import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { TherapyList } from '@/features/therapies/TherapyList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Therapies');
  return { title: t('title') };
}

export default async function TherapiesPage() {
  const t = await getTranslations('Therapies');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <TherapyList />
    </>
  );
}
