import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn';
import { RegisterForm } from '@/features/auth/RegisterForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Register');
  return { title: t('title') };
}

export default async function RegisterPage() {
  const t = await getTranslations('Register');
  const tCommon = await getTranslations('Common');

  return (
    <>
      <RedirectIfSignedIn />
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      <RegisterForm />

      <p className="mt-8 text-center text-sm text-slate-500">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
          {tCommon('signIn')}
        </Link>
      </p>
    </>
  );
}
