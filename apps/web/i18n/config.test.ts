import { describe, expect, it } from 'vitest';
import { isLocale, matchLocale } from './config';

describe('isLocale', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('ro')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('matchLocale', () => {
  it('picks the first supported language, ignoring the region', () => {
    expect(matchLocale('ro-RO,ro;q=0.9,en-US;q=0.8')).toBe('ro');
    expect(matchLocale('fr-FR,en;q=0.5')).toBe('en');
  });

  it('falls back to English', () => {
    expect(matchLocale(null)).toBe('en');
    expect(matchLocale('de-DE')).toBe('en');
  });
});
