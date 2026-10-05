import { describe, expect, it } from 'vitest';
import { layoutWeek } from './weekLayout';

describe('layoutWeek', () => {
  const event = (startDate: string, endDate: string) => ({ startDate, endDate });

  it('cuts events at the week edges and stacks overlaps into lanes', () => {
    const { pieces, lanes } = layoutWeek('2026-10-19', [
      event('2026-10-21', '2026-10-23'), // Wed–Fri
      event('2026-10-24', '2026-11-01'), // Sat, runs into next week
      event('2026-10-22', '2026-10-22'), // Thu, overlaps the first
      event('2026-10-01', '2026-10-05'), // a different week
    ]);

    expect(lanes).toBe(2);
    expect(pieces.map(({ startColumn, endColumn, lane, clippedEnd }) => [startColumn, endColumn, lane, clippedEnd])).toEqual([
      [2, 4, 0, false],
      [3, 3, 1, false],
      [5, 6, 0, true],
    ]);
  });
});
