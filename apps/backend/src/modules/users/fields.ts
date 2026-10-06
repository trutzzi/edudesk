// Reading the fields of a person's account from a request body, shared by the admin's routes and a person's own
// profile. Each throws a 400 (or returns what to store).
import { HttpError } from '../../http/errors.js';
import { hashPassword } from '../../lib/password.js';
import { normalizePhone } from '../../lib/phone.js';
import { isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import { isPaymentType } from './users.repository.js';

// The admin sets passwords and reads them out, so short and easy is the point: the app generates 6 characters
export const MIN_PASSWORD_LENGTH = 6;
export const MAX_TEXT_LENGTH = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOCALES = ['ro', 'en'] as const;

export const invalid = (message: string, code?: string) => new HttpError(400, message, code);

export const readEmail = (value: unknown) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !EMAIL_PATTERN.test(value.trim())) throw invalid('That is not an email address');
  return value.trim().toLowerCase();
};

export const readPhone = (value: unknown) => {
  const phone = normalizePhone(value);
  if (!phone) throw invalid('That is not a phone number', 'INVALID_PHONE');
  return phone;
};

export const readPassword = (value: unknown) => {
  if (typeof value !== 'string' || value.length < MIN_PASSWORD_LENGTH) {
    throw invalid(`The password needs at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return hashPassword(value);
};

// Therapy ids; the repository checks they're the school's
export const readSpecializations = (value: unknown) => {
  if (!Array.isArray(value) || !value.every(isUuid)) throw invalid('Specializations must be therapies from the list', 'NOT_A_THERAPY');
  return [...new Set(value)];
};

export const readPaymentType = (value: unknown) => {
  if (value === null || value === '') return null;
  if (!isPaymentType(value)) throw invalid('Payment type must be cas or sponsored');
  return value;
};

// Details or notes: free text, empty meaning none
export const readText = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) throw invalid(`Text can have up to ${MAX_TEXT_LENGTH} characters`);
  return value.trim() || null;
};

export const readLocale = (value: unknown) => {
  if (value === null || value === '') return null;
  if (!LOCALES.includes(value as (typeof LOCALES)[number])) throw invalid('The language must be ro or en');
  return value as (typeof LOCALES)[number];
};

// A phone or email someone else already has
export function toMemberError(err: unknown) {
  if (isPgError(err, PG_ERRORS.uniqueViolation)) {
    return new HttpError(409, 'Someone already has this phone number or email', 'CONTACT_TAKEN');
  }
  return err;
}
