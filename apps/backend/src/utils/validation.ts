import { DatabaseError } from 'pg';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

// Postgres rejects malformed UUIDs with an error, so check them before they reach a query
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);

// A real calendar day as YYYY-MM-DD: rejects "2026-02-30", which the pattern alone would let through
export const isDateString = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

// A time of day as HH:MM, 00:00–23:59
export const isTimeString = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Whole days from one YYYY-MM-DD to another
export const daysBetween = (from: string, to: string) =>
  (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

// https://www.postgresql.org/docs/current/errcodes-appendix.html
export const PG_ERRORS = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  checkViolation: '23514',
  exclusionViolation: '23P01',
} as const;

export const isPgError = (err: unknown, code: string) => err instanceof DatabaseError && err.code === code;
