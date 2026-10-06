import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ClientCard } from '@/features/sessions/ClientCard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ClientCard');
  return { title: t('title') };
}

export default async function ClientPage({ params }: PageProps<'/dashboard/clients/[id]'>) {
  const { id } = await params;
  return <ClientCard clientId={id} />;
}
