import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import attendanceRoutes from './attendance.routes.js';
import clientRoutes from './clients.routes.js';
import reportRoutes from './reports.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express()
  .use(express.json())
  .use('/api/attendance', attendanceRoutes)
  .use('/api/clients', clientRoutes)
  .use('/api/reports', reportRoutes)
  .use(errorHandler);

const auth = (role: string, id = 'u1') => `Bearer ${generateToken({ id, email: null, role, school_id: 's1' })}`;

const COURSE_ID = '2f717abb-8a86-45fc-a311-d7959b9c8751';
const CLIENT_ID = '66c5e83f-a481-4e92-b8b3-192f75b5d53a';
const row = {
  schoolId: 's1',
  courseId: COURSE_ID,
  courseName: 'Kineto',
  date: '2026-10-05',
  startTime: '08:00',
  endTime: '08:50',
  hours: 50 / 60,
  room: null,
  class: { id: 'r1', name: 'Sala Verde' },
  teacher: { id: 'u1', firstName: 'Elena', lastName: 'Pop' },
  client: { id: CLIENT_ID, firstName: 'Ana', lastName: 'Ionescu' },
  status: 'present',
  markedAt: null,
};

// Answers by what each query reads: today's date, the sessions, a client
function serve({ today = '2026-10-05', sessions = [row] as object[], client = undefined as object | undefined } = {}) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes('AS today')) return { rows: [{ today }] };
    if (sql.includes('FROM lessons')) return { rows: sessions };
    if (sql.includes('FROM users c')) return { rows: client ? [client] : [] };
    return { rows: [] };
  });
}

const sessionsQuery = () => query.mock.calls.find(([sql]) => String(sql).includes('FROM lessons'));

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/attendance', () => {
  it("lists a therapist's sessions for the day with their clients", async () => {
    serve({ sessions: [row, { ...row, courseId: 'other', teacher: { id: 'u9', firstName: 'Dan', lastName: 'Ene' } }] });

    const res = await request(app).get('/api/attendance?date=2026-10-05').set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(res.body.editable).toBe(true);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].clients[0]).toMatchObject({ client: row.client, status: 'present' });
  });

  it('says a future day cannot be marked yet', async () => {
    serve({ sessions: [] });

    const res = await request(app).get('/api/attendance?date=2026-10-06').set('Authorization', auth('school_admin'));

    expect(res.body.editable).toBe(false);
  });

  it('is not for clients', async () => {
    expect((await request(app).get('/api/attendance?date=2026-10-05').set('Authorization', auth('student'))).status).toBe(403);
  });
});

describe('POST /api/attendance', () => {
  const mark = { courseId: COURSE_ID, date: '2026-10-05', startTime: '08:00', studentId: CLIENT_ID, status: 'absent_late' };
  const post = (body: object, role = 'teacher', id = 'u1') =>
    request(app).post('/api/attendance').set('Authorization', auth(role, id)).send(body);
  const inserted = () => query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO attendance_marks'));

  it("adds the therapist's mark", async () => {
    serve();

    const res = await post(mark);

    expect(res.status).toBe(201);
    expect(inserted()?.[1]).toEqual([COURSE_ID, CLIENT_ID, '2026-10-05', '08:00', 'absent_late', 'u1']);
  });

  it("won't let another therapist mark it", async () => {
    serve();

    expect((await post(mark, 'teacher', 'u9')).status).toBe(403);
    expect(inserted()).toBeUndefined();
  });

  it('lets an admin mark any session in the institution', async () => {
    serve();

    expect((await post(mark, 'school_admin', 'a1')).status).toBe(201);
  });

  it('returns 404 when the client has no such session', async () => {
    serve({ sessions: [] });

    expect((await post(mark)).status).toBe(404);
  });

  it('refuses a session in the future', async () => {
    serve({ today: '2026-10-04' });

    const res = await post(mark);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FUTURE_SESSION');
  });

  it('rejects an unknown status', async () => {
    expect((await post({ ...mark, status: 'late' })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('client card', () => {
  const card = { id: CLIENT_ID, firstName: 'Ana', lastName: 'Ionescu', phone: '+40722111222', paymentType: 'cas', rooms: [] };

  it('shows staff how the therapy is paid for', async () => {
    serve({ client: card });

    const res = await request(app).get(`/api/clients/${CLIENT_ID}`).set('Authorization', auth('teacher'));

    expect(res.body.paymentType).toBe('cas');
    // A therapist only sees clients in their rooms
    expect(query.mock.calls[0]?.[0]).toContain('co.teacher_id = $2');
  });

  it('hides the payment type from the client', async () => {
    serve({ client: card });

    const res = await request(app).get(`/api/clients/${CLIENT_ID}`).set('Authorization', auth('student', CLIENT_ID));

    expect(res.body.paymentType).toBeNull();
    expect(query.mock.calls[0]?.[0]).toContain('c.id = $2');
  });

  it("returns 404 for a client the caller can't see", async () => {
    serve();

    expect((await request(app).get(`/api/clients/${CLIENT_ID}`).set('Authorization', auth('teacher'))).status).toBe(404);
  });

  it('lists sessions only up to today', async () => {
    serve({ client: card });

    const res = await request(app)
      .get(`/api/clients/${CLIENT_ID}/sessions?from=2026-10-01&to=2026-10-31`)
      .set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(sessionsQuery()?.[1]).toEqual(['2026-10-01', '2026-10-05', CLIENT_ID]);
  });
});

describe('GET /api/reports', () => {
  it("gives a therapist their clients' full history and only their own hours", async () => {
    serve({ sessions: [row, { ...row, courseId: 'aba', teacher: { id: 'u9', firstName: 'Dan', lastName: 'Ene' } }] });

    const res = await request(app).get('/api/reports?month=2026-10').set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(sessionsQuery()?.[0]).toContain('co2.teacher_id = $3');
    expect(sessionsQuery()?.[1]).toEqual(['2026-10-01', '2026-10-05', 'u1']);
    expect(res.body.clients[0].sessions).toBe(2);
    expect(res.body.therapists).toHaveLength(1);
    expect(res.body.therapists[0].teacher.id).toBe('u1');
  });

  it("is empty for a month that hasn't started", async () => {
    serve();

    const res = await request(app).get('/api/reports?month=2026-11').set('Authorization', auth('school_admin'));

    expect(res.body).toEqual({ month: '2026-11', clients: [], therapists: [] });
    expect(sessionsQuery()).toBeUndefined();
  });

  it('rejects a bad month', async () => {
    expect((await request(app).get('/api/reports?month=october').set('Authorization', auth('school_admin'))).status).toBe(400);
  });
});
