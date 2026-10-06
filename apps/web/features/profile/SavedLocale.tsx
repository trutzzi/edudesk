'use client';

import { useLocale } from 'next-intl';
import { useEffect, useTransition } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { setLocale } from '@/i18n/actions';

// Switches the app to the language saved in the person's profile once they're signed in, on any device
export function SavedLocale() {
  const { user } = useAuth();
  const current = useLocale();
  const [, startTransition] = useTransition();
  const saved = user?.locale;

  useEffect(() => {
    if (saved && saved !== current) startTransition(() => setLocale(saved));
  }, [saved, current]);

  return null;
}
