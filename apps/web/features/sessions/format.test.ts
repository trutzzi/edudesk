import { describe, expect, it } from 'vitest';
import { formatHours, formatMonth, groupByDay, shiftMonth, summarize } from './format';
import type { ClientSession } from './types';

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

const session = (date: string, status: ClientSession['status'], hours = 1): ClientSession => ({
  courseId: 'k1',
  courseName: 'Kineto',
  date,
  startTime: '09:00',
  endTime: '10:00',
  hours,
  room: null,
  class: { id: 'r1', name: 'Sala Verde' },
  teacher: { id: 't1', firstName: 'Elena', lastName: 'Pop' },
  status,
});

describe('client history', () => {
  it('counts each status and only the present sessions as hours', () => {
    const summary = summarize([
      session('2026-10-05', 'present', 1.5),
      session('2026-10-06', 'absent_late'),
      session('2026-10-07', 'present', 0.5),
    ]);

    expect(summary).toMatchObject({ hours: 2, total: 3, counts: { present: 2, absent_late: 1, absent_notice: 0, cancelled: 0 } });
  });

  it('groups sessions by day, newest day first', () => {
    const days = groupByDay([session('2026-10-05', 'present'), session('2026-10-05', 'cancelled'), session('2026-10-07', 'present')]);

    expect(days.map(([day, rows]) => [day, rows.length])).toEqual([
      ['2026-10-07', 1],
      ['2026-10-05', 2],
    ]);
  });
});
