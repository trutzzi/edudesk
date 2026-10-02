import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../db.js';
import { generateToken } from '../utils/auth.js';
import { errorHandler } from '../middleware/errors.js';
import timetableRoutes from './timetable.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use('/api/timetable', timetableRoutes).use(errorHandler);

const auth = (role: string) =>
  `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

const lessonsQuery = () => query.mock.calls.find(([sql]) => String(sql).includes('FROM lessons'));

beforeEach(() => {
  query.mockReset();
  query.mockImplementation(async (sql: string) =>
    sql.includes('FROM schools') ? { rows: [{ timezone: 'Europe/Bucharest' }] } : { rows: [] }
  );
});

describe('GET /api/timetable', () => {
  it.each([
    ['teacher', 'co.teacher_id = $3'],
    ['student', 'FROM class_students WHERE student_id = $3'],
    ['parent', 'ps.parent_id = $3'],
  ])('shows a %s their own lessons', async (role, where) => {
    const res = await request(app).get('/api/timetable?from=2026-10-05&to=2026-10-11').set('Authorization', auth(role));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: 'Europe/Bucharest', lessons: [] });
    expect(lessonsQuery()?.[0]).toContain(where);
    expect(lessonsQuery()?.[1]).toEqual(['2026-10-05', '2026-10-11', 'u1']);
  });

  it('is not for admins, who have the timeline', async () => {
    const res = await request(app)
      .get('/api/timetable?from=2026-10-05&to=2026-10-11')
      .set('Authorization', auth('school_admin'));

    expect(res.status).toBe(403);
  });

  it("allows a month view's six weeks", async () => {
    // November 2026 as a month grid: Mon 26 Oct to Sun 6 Dec
    const res = await request(app).get('/api/timetable?from=2026-10-26&to=2026-12-06').set('Authorization', auth('student'));

    expect(res.status).toBe(200);
  });

  it('allows at most six weeks', async () => {
    const res = await request(app).get('/api/timetable?from=2026-10-01&to=2026-12-01').set('Authorization', auth('student'));

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
