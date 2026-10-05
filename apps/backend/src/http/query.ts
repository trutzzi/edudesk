import type { Request } from 'express';
import { daysBetween, isDateString, isUuid } from '../lib/validation.js';
import { HttpError } from './errors.js';

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD, at most `maxDays` apart
export function readDateRange(query: Request['query'], maxDays: number) {
  const { from, to } = query;
  if (!isDateString(from) || !isDateString(to) || daysBetween(from, to) < 0 || daysBetween(from, to) > maxDays) {
    throw new HttpError(400, `from and to must be dates (YYYY-MM-DD) at most ${maxDays} days apart`);
  }
  return { from, to };
}

// A route's :id that must be a UUID; anything else can't exist, so it's a 404 rather than a database error
export function readId(value: unknown, notFoundMessage: string) {
  if (!isUuid(value)) throw new HttpError(404, notFoundMessage);
  return value;
}

// A JSON body is untrusted: every field is `unknown` until a route validates it
export function readBody(req: Request): Record<string, unknown> {
  const body: unknown = req.body;
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
