import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { MyStudents } from '@/features/students/MyStudents';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('MyStudents');
  return { title: t('title') };
}

export default async function StudentsPage() {
  const t = await getTranslations('MyStudents');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MyStudents />
    </>
  );
}
