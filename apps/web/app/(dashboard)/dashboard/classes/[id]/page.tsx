import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClassDetail } from '@/features/classes/ClassDetail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Classes');
  return { title: t('title') };
}

export default async function ClassPage({ params }: PageProps<'/dashboard/classes/[id]'>) {
  const { id } = await params;
  return <ClassDetail classId={id} />;
}
