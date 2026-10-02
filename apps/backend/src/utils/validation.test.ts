import { describe, expect, it } from 'vitest';
import { daysBetween, isDateString, isTimeString } from './validation.js';

describe('isDateString', () => {
  it('accepts real days', () => {
    expect(isDateString('2026-10-02')).toBe(true);
    expect(isDateString('2028-02-29')).toBe(true);
  });

  it('rejects impossible days and other formats', () => {
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-10-2')).toBe(false);
    expect(isDateString(20261002)).toBe(false);
  });
});

describe('isTimeString', () => {
  it('accepts HH:MM', () => {
    expect(isTimeString('08:00')).toBe(true);
    expect(isTimeString('23:59')).toBe(true);
  });

  it('rejects out-of-range times', () => {
    expect(isTimeString('24:00')).toBe(false);
    expect(isTimeString('8:00')).toBe(false);
  });
});

describe('daysBetween', () => {
  it('counts whole days, ignoring daylight saving', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-09-01', '2026-08-31')).toBe(-1);
  });
});
