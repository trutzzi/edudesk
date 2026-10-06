'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/button';
import type { User } from '@/features/auth/AuthProvider';
import { Logo } from './Logo';

export function DashboardHeader({ user, onLogout }: { user: User; onLogout: () => void }) {
  const t = useTranslations('Common');
  const tRoles = useTranslations('Roles');

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
      <Logo />
      <div className="flex items-center gap-2 sm:gap-4">
        {/* The person's profile: their details, language and password. On phones, just the initials. */}
        <Link
          href="/dashboard/profile"
          aria-label={`${t('profile')}: ${user.firstName} ${user.lastName}`}
          className="flex items-center gap-3 rounded-xl p-1 transition hover:bg-slate-100 sm:pr-3"
        >
          <Avatar firstName={user.firstName} lastName={user.lastName} size="md" />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{tRoles(user.role)}</p>
          </div>
        </Link>
        <button type="button" onClick={onLogout} className={buttonClass('secondary', 'sm')}>
          {t('logOut')}
        </button>
      </div>
    </header>
  );
}
