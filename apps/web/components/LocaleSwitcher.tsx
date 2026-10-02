'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from '@/i18n/actions';
import { locales } from '@/i18n/config';

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t('label')}
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold ${pending ? 'opacity-60' : ''}`}
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            title={t(locale)}
            aria-label={t(locale)}
            aria-pressed={active}
            disabled={pending}
            onClick={() => !active && startTransition(() => setLocale(locale))}
            className={`rounded-md px-2.5 py-1 uppercase transition ${
              active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {locale}
          </button>
        );
      })}
    </div>
  );
}
