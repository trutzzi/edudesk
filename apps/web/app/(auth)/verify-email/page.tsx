import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RedirectIfSignedIn } from '../RedirectIfSignedIn';
import { VerifyEmail } from './VerifyEmail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Verify');
  return { title: t('title') };
}

// Opened from the link in the confirmation email: /verify-email?token=…
export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const { token } = await searchParams;
  const t = await getTranslations('Verify');

  return (
    <>
      <RedirectIfSignedIn />
      <h1 className="mb-6 text-center text-xl font-bold">{t('title')}</h1>
      <VerifyEmail token={typeof token === 'string' ? token : null} />
    </>
  );
}
