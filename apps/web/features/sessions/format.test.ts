import { describe, expect, it } from 'vitest';
import { formatHours, formatMonth, shiftMonth } from './format';

describe('session formatting', () => {
  it('moves across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('writes hours with one decimal in the language', () => {
    expect(formatHours(50 / 60, 'ro')).toBe('0,8');
    expect(formatHours(2, 'en')).toBe('2');
  });

  it('names the month', () => {
    expect(formatMonth('2026-10', 'ro')).toBe('octombrie 2026');
  });
});
