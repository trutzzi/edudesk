import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { InstitutionSettings } from '@/features/branding/InstitutionSettings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Institution');
  return { title: t('title') };
}

export default async function InstitutionPage() {
  const t = await getTranslations('Institution');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <InstitutionSettings />
    </>
  );
}
