import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClassList } from '@/features/classes/ClassList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Classes');
  return { title: t('title') };
}

export default async function ClassesPage() {
  const t = await getTranslations('Classes');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ClassList />
    </>
  );
}
