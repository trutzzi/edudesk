'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/features/auth/AuthProvider';

const LINKS = [
  { href: '/dashboard', key: 'overview', roles: ['school_admin', 'super_admin'] },
  { href: '/dashboard/timetable', key: 'timetable', roles: ['teacher', 'student', 'parent'] },
  { href: '/dashboard/students', key: 'students', roles: ['teacher'] },
  { href: '/dashboard/timeline', key: 'timeline', roles: ['school_admin'] },
  { href: '/dashboard/classes', key: 'classes', roles: ['school_admin'] },
  { href: '/dashboard/people', key: 'people', roles: ['school_admin'] },
  // A school's calendar: not for super admins, who don't belong to one school
  { href: '/dashboard/calendar', key: 'calendar', roles: ['school_admin', 'teacher', 'student', 'parent'] },
] as const;

export function DashboardNav({ role }: { role: Role }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav aria-label={t('sections')} className="overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <ul className="mx-auto flex max-w-7xl gap-6">
        {LINKS.filter(({ roles }) => !roles || (roles as readonly Role[]).includes(role)).map(({ href, key }) => {
          // A class page counts as being in Classes
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-block border-b-2 py-3 text-sm font-semibold transition ${
                  active ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
