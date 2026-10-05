'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { setLocale } from '@/i18n/actions';
import { locales, type Locale } from '@/i18n/config';

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <SegmentedControl<Locale>
      label={t('label')}
      size="xs"
      value={current}
      disabled={pending}
      onChange={(locale) => startTransition(() => setLocale(locale))}
      segments={locales.map((locale) => ({ value: locale, label: locale.toUpperCase(), fullLabel: t(locale), lang: locale }))}
    />
  );
}
