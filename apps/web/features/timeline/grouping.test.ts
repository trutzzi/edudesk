import { describe, expect, it } from 'vitest';
import { groupItems, matchesSearch, type TimelineItem } from './grouping';

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
    expect(groups[0].rows.map((r) => [r.label, r.sublabel])).toEqual([
      ['English', 'Sarah Miller'],
      ['Matematică', 'Elena Popescu'],
    ]);
  });

  it('groups by teacher', () => {
    const groups = groupItems(items, 'teacher');
    expect(groups.map((g) => g.label)).toEqual(['Elena Popescu', 'Sarah Miller']);
    expect(groups[0].rows.map((r) => r.sublabel)).toEqual(['9A', '10B']);
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
