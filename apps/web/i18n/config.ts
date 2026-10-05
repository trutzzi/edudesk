export const locales = ['en', 'ro'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';
export const LOCALE_COOKIE = 'edudesk.locale';

export const isLocale = (value: unknown): value is Locale => locales.includes(value as Locale);

// First supported language in an Accept-Language header, ignoring region (`ro-RO` → `ro`)
export function matchLocale(acceptLanguage: string | null): Locale {
  const languages = (acceptLanguage ?? '').split(',').map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase());
  return languages.find(isLocale) ?? defaultLocale;
}
