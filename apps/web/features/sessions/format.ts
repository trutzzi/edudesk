import { parseDay } from '@/lib/dates/days';

// "luni, 5 octombrie"
export const formatLongDay = (day: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseDay(day));

// "octombrie 2026"
export const formatMonth = (month: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseDay(`${month}-01`));

// 0.8333 → "0,8"
export const formatHours = (hours: number, locale: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours);

// "2026-10" moved by some months
export function shiftMonth(month: string, by: number) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(year, index - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}
