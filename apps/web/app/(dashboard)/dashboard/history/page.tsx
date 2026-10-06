import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MyHistory } from '@/features/sessions/MyHistory';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('history') };
}

export default function HistoryPage() {
  return <MyHistory />;
}
