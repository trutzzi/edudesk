'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';

interface Titled {
  title: string;
  // Public holidays also come with an English name; school events have only the name the admin typed
  englishTitle?: string;
}

// An event's title in the current language
export function useEventTitle() {
  const locale = useLocale();
  return useCallback((event: Titled) => (locale !== 'ro' && event.englishTitle ? event.englishTitle : event.title), [locale]);
}
