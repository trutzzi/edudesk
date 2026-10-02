'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { api, isAuthError } from '@/lib/api';
import { ErrorAlert } from '@/components/ui/Alert';

interface Stats {
  studentsCount: number;
  teachersCount: number;
  adminsCount: number;
  classesCount: number;
}

const CARDS: { key: keyof Stats; tone: string; icon: string }[] = [
  {
    key: 'studentsCount',
    tone: 'border-sky-100 bg-sky-50 text-sky-600',
    icon: 'M12 14l9-5-9-5-9 5 9 5z',
  },
  {
    key: 'teachersCount',
    tone: 'border-emerald-100 bg-emerald-50 text-emerald-600',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    key: 'adminsCount',
    tone: 'border-purple-100 bg-purple-50 text-purple-600',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    key: 'classesCount',
    tone: 'border-amber-100 bg-amber-50 text-amber-600',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

export function StatsGrid() {
  const t = useTranslations('Dashboard');
  const format = useFormatter();
  const { token, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    api<Stats>('/api/dashboard/stats', { token, signal: controller.signal })
      .then(setStats)
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (isAuthError(err)) logout();
        else setFailed(true);
      });

    return () => controller.abort();
  }, [token, logout]);

  if (failed) {
    return (
      <ErrorAlert>{t('loadError')}</ErrorAlert>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, tone, icon }) => (
        <div key={key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{t(`stats.${key}`)}</span>
            <div className={`rounded-xl border p-2.5 ${tone}`}>
              <svg aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </div>
          </div>
          {stats ? (
            <p className="mt-4 text-3xl font-bold">{format.number(stats[key])}</p>
          ) : (
            <div className="mt-4 h-9 w-16 animate-pulse rounded-lg bg-slate-200" />
          )}
        </div>
      ))}
    </div>
  );
}
