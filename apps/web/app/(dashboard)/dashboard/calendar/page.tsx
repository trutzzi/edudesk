import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { SchoolCalendar } from '@/features/calendar/SchoolCalendar';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Calendar');
  return { title: t('title') };
}

export default async function CalendarPage() {
  const t = await getTranslations('Calendar');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SchoolCalendar />
    </>
  );
}
