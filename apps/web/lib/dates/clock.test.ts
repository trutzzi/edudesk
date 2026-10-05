import { describe, expect, it } from 'vitest';
import { nowIn } from './clock';

describe('nowIn', () => {
  it('reads the wall clock in the given time zone', () => {
    const at = new Date('2026-10-02T05:30:00Z');
    expect(nowIn('Europe/Bucharest', at)).toEqual({ day: '2026-10-02', minutes: 8 * 60 + 30 });
    expect(nowIn('America/New_York', at)).toEqual({ day: '2026-10-02', minutes: 1 * 60 + 30 });
  });

  it('follows daylight saving', () => {
    // Romania leaves summer time on 25 Oct 2026: 05:30 UTC is 08:30 before and 07:30 after
    expect(nowIn('Europe/Bucharest', new Date('2026-10-26T05:30:00Z')).minutes).toBe(7 * 60 + 30);
  });
});
