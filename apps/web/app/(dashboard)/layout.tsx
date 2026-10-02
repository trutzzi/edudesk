'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { Logo } from '@/components/Logo';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { DashboardNav } from '@/components/DashboardNav';
import { NoSchool, SchoolSetup } from '@/components/SchoolSetup';
import { buttonClass } from '@/components/ui/button';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('Common');
  const tRoles = useTranslations('Roles');
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="flex items-center gap-2 sm:gap-4">
          <LocaleSwitcher />
          {/* Phones only have room for the language switch and log out */}
          <div className="hidden items-center gap-3 sm:flex">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-sm font-bold text-indigo-700">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-none">
                {user.firstName} {user.lastName}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{tRoles(user.role)}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className={buttonClass('secondary', 'sm')}>
            {t('logOut')}
          </button>
        </div>
      </header>
      {/* Everything in the dashboard belongs to a school; super admins oversee all of them */}
      {user.schoolId || user.role === 'super_admin' ? (
        <>
          <DashboardNav role={user.role} />
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-6 lg:p-8">{children}</main>
        </>
      ) : (
        <main className="flex-1 p-6 lg:p-8">{user.role === 'school_admin' ? <SchoolSetup /> : <NoSchool />}</main>
      )}
    </>
  );
}
