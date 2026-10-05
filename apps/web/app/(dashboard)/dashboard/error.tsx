'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { buttonClass } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthProvider';
import { reportClientError } from '@/lib/reportError';

// Shown in place of a dashboard page that crashed while rendering; the header and menu stay usable
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations('PageError');
  const { token } = useAuth();

  useEffect(() => {
    reportClientError(error, token);
  }, [error, token]);

  return (
    <div role="alert" className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <p className="mt-2 text-sm text-slate-600">{t('body')}</p>
      <button type="button" onClick={retry} className={`${buttonClass()} mt-5`}>
        {t('retry')}
      </button>
    </div>
  );
}
