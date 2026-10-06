import type { AttendanceStatus, ClientSession } from './sessions.repository.js';

// The session a client has just before or after another one the same day
interface Neighbour {
  courseName: string;
  startTime: string;
  endTime: string;
  teacher: ClientSession['teacher'];
}

export interface RosterEntry {
  client: ClientSession['client'];
  status: AttendanceStatus;
  markedAt: string | null;
  before: Neighbour | null;
  after: Neighbour | null;
}

export interface Roster extends Omit<ClientSession, 'client' | 'status' | 'markedAt' | 'schoolId'> {
  clients: RosterEntry[];
}

const sessionKey = (row: ClientSession) => `${row.courseId}|${row.date}|${row.startTime}`;
const toNeighbour = (row: ClientSession | undefined): Neighbour | null =>
  row ? { courseName: row.courseName, startTime: row.startTime, endTime: row.endTime, teacher: row.teacher } : null;

// Groups client rows into sessions, each with its clients' status and what therapy they have before and after it.
// `shown` are the rows to list; `everything` holds every session those clients have that day, whoever holds it.
export function buildRosters(shown: ClientSession[], everything: ClientSession[]): Roster[] {
  const dayOf = new Map<string, ClientSession[]>();
  for (const row of everything) {
    const key = `${row.client.id}|${row.date}`;
    dayOf.set(key, [...(dayOf.get(key) ?? []), row]);
  }

  const rosters = new Map<string, Roster>();
  for (const row of shown) {
    const { client, status, markedAt, schoolId: _schoolId, ...session } = row;
    const roster = rosters.get(sessionKey(row)) ?? { ...session, clients: [] };
    rosters.set(sessionKey(row), roster);

    const day = [...(dayOf.get(`${client.id}|${row.date}`) ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const at = day.findIndex((other) => sessionKey(other) === sessionKey(row));
    roster.clients.push({
      client,
      status,
      markedAt,
      before: toNeighbour(at > 0 ? day[at - 1] : undefined),
      after: toNeighbour(at >= 0 ? day[at + 1] : undefined),
    });
  }
  return [...rosters.values()];
}

export interface ClientTotals {
  client: ClientSession['client'];
  sessions: number;
  // Hours of the sessions the client came to
  hours: number;
  counts: Record<AttendanceStatus, number>;
  therapies: string[];
}

export interface TherapistTotals {
  teacher: ClientSession['teacher'];
  // Sessions at least one client came to, and their hours
  sessions: number;
  hours: number;
}

const emptyCounts = (): Record<AttendanceStatus, number> => ({ present: 0, absent_notice: 0, absent_late: 0, cancelled: 0 });
const byName = (a: { lastName: string; firstName: string }, b: { lastName: string; firstName: string }) =>
  a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

// Per client: their sessions by status; per therapist: the hours they held, counting only sessions with a client present
export function monthlyTotals(rows: ClientSession[]) {
  const clients = new Map<string, ClientTotals & { therapySet: Set<string> }>();
  const heldSessions = new Map<string, ClientSession>();

  for (const row of rows) {
    const totals = clients.get(row.client.id) ?? {
      client: row.client,
      sessions: 0,
      hours: 0,
      counts: emptyCounts(),
      therapies: [],
      therapySet: new Set<string>(),
    };
    clients.set(row.client.id, totals);
    totals.sessions++;
    totals.counts[row.status]++;
    totals.therapySet.add(row.courseName);
    if (row.status === 'present') {
      totals.hours += row.hours;
      heldSessions.set(sessionKey(row), row);
    }
  }

  const therapists = new Map<string, TherapistTotals>();
  for (const session of heldSessions.values()) {
    const totals = therapists.get(session.teacher.id) ?? { teacher: session.teacher, sessions: 0, hours: 0 };
    therapists.set(session.teacher.id, totals);
    totals.sessions++;
    totals.hours += session.hours;
  }

  return {
    clients: [...clients.values()]
      .map(({ therapySet, ...totals }) => ({ ...totals, therapies: [...therapySet].sort() }))
      .sort((a, b) => byName(a.client, b.client)),
    therapists: [...therapists.values()].sort((a, b) => byName(a.teacher, b.teacher)),
  };
}

// "2026-10" → its first and last day
export function monthRange(month: string) {
  const [year, monthIndex] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

export const isMonth = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
