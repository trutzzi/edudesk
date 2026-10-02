import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { RedirectIfSignedIn } from '../RedirectIfSignedIn';
import { RegisterForm } from './RegisterForm';

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
