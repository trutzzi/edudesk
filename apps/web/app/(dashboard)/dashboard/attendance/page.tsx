import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { AttendanceDay } from '@/features/sessions/AttendanceDay';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Attendance');
  return { title: t('title') };
}

export default async function AttendancePage() {
  const t = await getTranslations('Attendance');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <AttendanceDay />
    </>
  );
}
