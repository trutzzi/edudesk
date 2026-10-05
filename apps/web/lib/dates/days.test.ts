import { describe, expect, it } from 'vitest';
import { addMonths, isoWeekday } from './days';

describe('days', () => {
  it('knows the ISO weekday', () => {
    expect(isoWeekday('2026-10-05')).toBe(1); // Monday
    expect(isoWeekday('2026-10-04')).toBe(7); // Sunday
  });

  it('adds months from the first of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-01');
  });
});
