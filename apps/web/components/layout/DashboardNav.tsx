'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavIcon } from '@/components/ui/NavIcon';
import type { Role } from '@/features/auth/AuthProvider';

const LINKS = [
  { href: '/dashboard', key: 'overview', roles: ['school_admin', 'super_admin'] },
  { href: '/dashboard/timetable', key: 'timetable', roles: ['teacher', 'student', 'parent'] },
  { href: '/dashboard/attendance', key: 'attendance', roles: ['teacher', 'school_admin'] },
  { href: '/dashboard/students', key: 'students', roles: ['teacher'] },
  { href: '/dashboard/history', key: 'history', roles: ['student'] },
  { href: '/dashboard/reports', key: 'reports', roles: ['teacher', 'school_admin'] },
  { href: '/dashboard/timeline', key: 'timeline', roles: ['school_admin'] },
  { href: '/dashboard/classes', key: 'classes', roles: ['school_admin'] },
  { href: '/dashboard/people', key: 'people', roles: ['school_admin'] },
  { href: '/dashboard/therapies', key: 'therapies', roles: ['school_admin'] },
  { href: '/dashboard/institution', key: 'institution', roles: ['school_admin'] },
  // A school's calendar: not for super admins, who don't belong to one school
  { href: '/dashboard/calendar', key: 'calendar', roles: ['school_admin', 'teacher', 'student', 'parent'] },
] as const;

const linksFor = (role: Role) => LINKS.filter(({ roles }) => (roles as readonly Role[]).includes(role));

// Whether this role gets the phone's bottom tab bar, so the page can leave room for it
export const hasTabBar = (role: Role) => linksFor(role).length > 1;

// The dashboard's sections. Phones: a tab bar along the bottom, in reach of the thumb, scrolling sideways
// when a role has more sections than fit.
// From sm up: a row of tabs under the header.
export function DashboardNav({ role }: { role: Role }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const links = linksFor(role);

  return (
    <nav
      aria-label={t('sections')}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:static sm:block sm:border-t-0 sm:border-b sm:bg-white sm:px-6 sm:pb-0 sm:backdrop-blur-none lg:px-8 ${
        hasTabBar(role) ? '' : 'hidden'
      }`}
    >
      <ul className="mx-auto flex max-w-7xl overflow-x-auto sm:gap-6">
        {links.map(({ href, key }) => {
          // A class page counts as being in Classes
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="min-w-16 flex-1 sm:min-w-0 sm:flex-none">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold transition sm:min-h-0 sm:flex-row sm:gap-1.5 sm:border-b-2 sm:px-0 sm:py-3 sm:text-sm sm:whitespace-nowrap ${
                  active ? 'text-indigo-600 sm:border-indigo-600' : 'text-slate-500 hover:text-slate-900 sm:border-transparent'
                }`}
              >
                <NavIcon name={key} className="h-6 w-6 sm:h-4 sm:w-4" />
                <span className="max-w-full truncate">{t(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
