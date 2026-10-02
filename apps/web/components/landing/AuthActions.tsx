'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { buttonClass } from '@/components/ui/button';
import { homeFor } from '@/lib/roles';

export function NavActions() {
  const t = useTranslations('Common');
  const tLanding = useTranslations('Landing');
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-200" />;
  }

  if (!user) {
    return (
      <>
        <Link href="/login" className={buttonClass('ghost')}>
          {t('signIn')}
        </Link>
        <Link href="/register" className={buttonClass()}>
          {tLanding('getStarted')}
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="hidden text-sm font-medium text-slate-600 sm:inline">
        {user.firstName} {user.lastName}
      </span>
      <Link href={homeFor(user.role)} className={buttonClass()}>
        {t('dashboard')}
      </Link>
      <button type="button" onClick={logout} className={buttonClass('ghost')}>
        {t('logOut')}
      </button>
    </>
  );
}

export function HeroActions() {
  const t = useTranslations('Common');
  const tLanding = useTranslations('Landing');
  const { user, loading } = useAuth();

  if (loading) {
    return <div aria-hidden className="h-13 w-full sm:w-80" />;
  }

  if (user) {
    return (
      <Link href={homeFor(user.role)} className={buttonClass('primary', 'lg')}>
        {tLanding('goToDashboard')}
      </Link>
    );
  }

  return (
    <>
      <Link href="/register" className={buttonClass('primary', 'lg')}>
        {t('createAccount')}
      </Link>
      <Link href="/login" className={buttonClass('secondary', 'lg')}>
        {t('signIn')}
      </Link>
    </>
  );
}
