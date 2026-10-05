import { describe, expect, it } from 'vitest';
import { schoolYearOf } from './types';

describe('schoolYearOf', () => {
  it.each([
    ['2026-09-01', '2026-2027'],
    ['2026-12-31', '2026-2027'],
    ['2027-01-01', '2026-2027'],
    ['2027-08-31', '2026-2027'],
  ])('puts %s in %s', (day, year) => {
    expect(schoolYearOf(day)).toBe(year);
  });
});
