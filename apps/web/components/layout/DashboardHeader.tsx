'use client';

import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/button';
import type { User } from '@/features/auth/AuthProvider';
import { LocaleSwitcher } from './LocaleSwitcher';
import { Logo } from './Logo';

export function DashboardHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  const t = useTranslations('Common');
  const tRoles = useTranslations('Roles');

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <Logo />
      <div className="flex items-center gap-2 sm:gap-4">
        <LocaleSwitcher />
        {/* Phones only have room for the language switch and log out */}
        <div className="hidden items-center gap-3 sm:flex">
          <Avatar firstName={user.firstName} lastName={user.lastName} size="md" />
          <div>
            <p className="text-sm font-semibold leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{tRoles(user.role)}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className={buttonClass('secondary', 'sm')}>
          {t('logOut')}
        </button>
      </div>
    </header>
  );
}
