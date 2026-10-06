import { describe, expect, it } from 'vitest';
import { buildRosters, isMonth, monthlyTotals, monthRange } from './sessions.js';
import type { ClientSession } from './sessions.repository.js';

const elena = { id: 't1', firstName: 'Elena', lastName: 'Pop' };
const dan = { id: 't2', firstName: 'Dan', lastName: 'Ene' };
const ana = { id: 'c1', firstName: 'Ana', lastName: 'Ionescu' };
const luca = { id: 'c2', firstName: 'Luca', lastName: 'Barbu' };

const session = (overrides: Partial<ClientSession>): ClientSession => ({
  schoolId: 's1',
  courseId: 'kineto',
  courseName: 'Kineto',
  date: '2026-10-05',
  startTime: '09:00',
  endTime: '10:00',
  hours: 1,
  room: null,
  class: { id: 'r1', name: 'Sala Verde' },
  teacher: elena,
  client: ana,
  status: 'present',
  markedAt: null,
  ...overrides,
});

describe('buildRosters', () => {
  it("groups clients into sessions and shows each client's therapy before and after", () => {
    const kinetoAna = session({});
    const kinetoLuca = session({ client: luca, status: 'absent_late' });
    const logopedie = session({ courseId: 'logo', courseName: 'Logopedie', startTime: '08:00', endTime: '08:50', teacher: dan });
    const aba = session({ courseId: 'aba', courseName: 'ABA', startTime: '11:00', endTime: '12:00', teacher: dan });

    const [roster] = buildRosters([kinetoAna, kinetoLuca], [logopedie, kinetoAna, kinetoLuca, aba]);

    expect(roster?.courseName).toBe('Kineto');
    expect(roster?.clients).toEqual([
      {
        client: ana,
        status: 'present',
        markedAt: null,
        before: { courseName: 'Logopedie', startTime: '08:00', endTime: '08:50', teacher: dan },
        after: { courseName: 'ABA', startTime: '11:00', endTime: '12:00', teacher: dan },
      },
      { client: luca, status: 'absent_late', markedAt: null, before: null, after: null },
    ]);
  });
});

describe('monthlyTotals', () => {
  it('counts every status per client and only present sessions as hours', () => {
    const { clients } = monthlyTotals([
      session({}),
      session({ date: '2026-10-06', status: 'absent_notice' }),
      session({ date: '2026-10-07', courseName: 'ABA', hours: 0.5 }),
    ]);

    expect(clients).toEqual([
      {
        client: ana,
        sessions: 3,
        hours: 1.5,
        counts: { present: 2, absent_notice: 1, absent_late: 0, cancelled: 0 },
        therapies: ['ABA', 'Kineto'],
      },
    ]);
  });

  it("counts a therapist's session once, and only when a client came", () => {
    const { therapists } = monthlyTotals([
      session({}),
      session({ client: luca }),
      session({ date: '2026-10-06', status: 'cancelled' }),
      session({ date: '2026-10-07', teacher: dan, status: 'absent_late' }),
    ]);

    expect(therapists).toEqual([{ teacher: elena, sessions: 1, hours: 1 }]);
  });
});

describe('months', () => {
  it('knows the last day of each month', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it.each(['2026-10', '2027-01'])('accepts %s', (month) => expect(isMonth(month)).toBe(true));
  it.each(['2026-13', '2026-1', 'oct', 12])('rejects %s', (month) => expect(isMonth(month)).toBe(false));
});
