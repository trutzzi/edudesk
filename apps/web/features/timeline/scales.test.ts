import { describe, expect, it } from 'vitest';
import { barPosition, dateScale, timeScale } from './scales';

describe('dateScale', () => {
  const scale = dateScale('2026-09-01', '2026-09-30', 'days');

  it('places days and times between 0 and 1', () => {
    expect(scale.x('2026-09-01')).toBe(0);
    expect(scale.x('2026-09-30', 1440)).toBe(1);
    expect(scale.x('2026-09-16')).toBe(0.5);
    expect(scale.x('2026-10-01', 60)).toBeNull();
  });

  it('labels months and weeks', () => {
    const term = dateScale('2026-09-01', '2027-01-31', 'weeks');
    expect(term.top.map((m) => m.day)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']);
    expect(term.bottom[0]).toMatchObject({ day: '2026-09-01' }); // a partial first week
    expect(term.bottom[1]).toMatchObject({ day: '2026-09-07' }); // then Mondays
  });

  it('clips bars that run past the edges', () => {
    expect(barPosition(scale, { day: '2026-08-20' }, { day: '2026-09-15', minutes: 1440 })).toEqual({
      left: 0,
      width: 0.5,
      clippedStart: true,
      clippedEnd: false,
    });
  });
});

describe('timeScale', () => {
  const scale = timeScale(['2026-10-05', '2026-10-06'], 8, 16);

  it('splits each day into the same hours', () => {
    expect(scale.x('2026-10-05', 8 * 60)).toBe(0);
    expect(scale.x('2026-10-06', 8 * 60)).toBe(0.5);
    expect(scale.x('2026-10-06', 12 * 60)).toBe(0.75);
  });

  it('is null outside the visible days and hours', () => {
    expect(scale.x('2026-10-05', 7 * 60)).toBeNull();
    expect(scale.x('2026-10-07', 9 * 60)).toBeNull();
  });
});
