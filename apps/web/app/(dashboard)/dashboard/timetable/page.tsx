import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MyTimetable } from './MyTimetable';
import { PageHeader } from '@/components/ui/PageHeader';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('MyTimetable');
  return { title: t('title') };
}

export default async function TimetablePage() {
  const t = await getTranslations('MyTimetable');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <MyTimetable />
    </>
  );
}
