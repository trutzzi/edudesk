import { describe, expect, it } from 'vitest';
import {
  addMonths,
  barPosition,
  dateScale,
  groupItems,
  hourWindow,
  isoWeekday,
  layoutWeek,
  matchesSearch,
  nowIn,
  rangeFor,
  shiftAnchor,
  timeScale,
  type TimelineItem,
} from './timeline';

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

describe('hourWindow', () => {
  it('defaults to the school day and grows to fit lessons', () => {
    expect(hourWindow([])).toEqual({ startHour: 8, endHour: 15 });
    expect(hourWindow([{ startTime: '07:30', endTime: '17:10' }])).toEqual({ startHour: 7, endHour: 18 });
  });
});

const item = (courseName: string, className: string, teacher: [string, string]): TimelineItem => ({
  id: `${courseName}-${className}`,
  courseId: `${courseName}-${className}`,
  courseName,
  class: { id: className, name: className },
  teacher: { id: teacher.join(' '), firstName: teacher[0], lastName: teacher[1] },
  startDay: '2026-09-07',
  endDay: '2027-06-18',
});

describe('groupItems', () => {
  const items = [
    item('Matematică', '10B', ['Elena', 'Popescu']),
    item('English', '9A', ['Sarah', 'Miller']),
    item('Matematică', '9A', ['Elena', 'Popescu']),
  ];

  it('groups by class with natural sorting', () => {
    const groups = groupItems(items, 'class');
    expect(groups.map((g) => g.label)).toEqual(['9A', '10B']);
    expect(groups[0]!.rows.map((r) => [r.label, r.sublabel])).toEqual([
      ['English', 'Sarah Miller'],
      ['Matematică', 'Elena Popescu'],
    ]);
  });

  it('groups by teacher', () => {
    const groups = groupItems(items, 'teacher');
    expect(groups.map((g) => g.label)).toEqual(['Elena Popescu', 'Sarah Miller']);
    expect(groups[0]!.rows.map((r) => r.sublabel)).toEqual(['9A', '10B']);
  });
});

describe('matchesSearch', () => {
  it('ignores case and Romanian diacritics', () => {
    const romana = item('Limba română', '9A', ['Mihai', 'Ionescu']);
    expect(matchesSearch(romana, 'ROMANA')).toBe(true);
    expect(matchesSearch(romana, 'ionescu')).toBe(true);
    expect(matchesSearch(romana, 'english')).toBe(false);
  });
});

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
