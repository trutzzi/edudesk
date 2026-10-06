import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { Profile } from '@/features/profile/Profile';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Profile');
  return { title: t('title') };
}

export default async function ProfilePage() {
  const t = await getTranslations('Profile');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Profile />
    </>
  );
}
