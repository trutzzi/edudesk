// Days are "YYYY-MM-DD" strings and all math runs in UTC, so daylight saving and the browser's
// time zone can never shift a day.

const DAY_MS = 86_400_000;

export const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);
export const formatDay = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => formatDay(new Date(parseDay(day).getTime() + days * DAY_MS));
export const diffDays = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

// ISO weekday: 1 = Monday … 7 = Sunday
export const isoWeekday = (day: string) => ((parseDay(day).getUTCDay() + 6) % 7) + 1;
export const isWeekend = (day: string) => isoWeekday(day) >= 6;
export const startOfWeek = (day: string) => addDays(day, 1 - isoWeekday(day));
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

export function addMonths(day: string, months: number) {
  const date = parseDay(startOfMonth(day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDay(date);
}

export const endOfMonth = (day: string) => addDays(addMonths(day, 1), -1);

export const daysInRange = (from: string, to: string) => Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i));
