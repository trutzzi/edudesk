import { describe, expect, it } from 'vitest';
import { rangeFor, shiftAnchor } from './ranges';

describe('rangeFor', () => {
  it('uses school terms', () => {
    expect(rangeFor('term', '2026-10-02')).toEqual({ from: '2026-09-01', to: '2027-01-31' });
    expect(rangeFor('term', '2027-01-15')).toEqual({ from: '2026-09-01', to: '2027-01-31' });
    expect(rangeFor('term', '2027-03-10')).toEqual({ from: '2027-02-01', to: '2027-06-30' });
  });

  it('starts weeks on Monday', () => {
    expect(rangeFor('week', '2026-10-02')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
  });

  it('covers whole months, leap years included', () => {
    expect(rangeFor('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('shiftAnchor', () => {
  it('moves by one page of the zoom', () => {
    expect(shiftAnchor('term', '2026-10-02', 1)).toBe('2027-02-01');
    expect(shiftAnchor('term', '2026-10-02', -1)).toBe('2026-08-31');
    expect(shiftAnchor('month', '2026-10-02', -1)).toBe('2026-09-30');
    expect(shiftAnchor('week', '2026-10-02', 1)).toBe('2026-10-09');
  });
});
