import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/LoginForm';
import { RedirectIfSignedIn } from '@/features/auth/RedirectIfSignedIn';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Common');
  return { title: t('signIn') };
}

export default async function LoginPage() {
  const t = await getTranslations('Login');

  return (
    <>
      <RedirectIfSignedIn />
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      <LoginForm />

      <p className="mt-8 text-center text-sm text-slate-500">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
          {t('createOne')}
        </Link>
      </p>
    </>
  );
}
