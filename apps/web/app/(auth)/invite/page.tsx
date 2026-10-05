import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AcceptInvitation } from '@/features/auth/AcceptInvitation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('People');
  return { title: t('invite') };
}

// Opened from the link in an invitation email: /invite?token=…
export default async function InvitePage({ searchParams }: PageProps<'/invite'>) {
  const { token } = await searchParams;
  return <AcceptInvitation token={typeof token === 'string' ? token : null} />;
}
