import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../db.js';
import { generateToken } from '../utils/auth.js';
import { errorHandler } from '../middleware/errors.js';
import timelineRoutes from './timeline.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use('/api/timeline', timelineRoutes).use(errorHandler);

const auth = (role = 'school_admin') =>
  `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

// The timezone lookup and the main query run together; answer each by its SQL
const answer = (rows: object[]) =>
  query.mockImplementation(async (sql: string) =>
    sql.includes('FROM schools') ? { rows: [{ timezone: 'Europe/Bucharest' }] } : { rows }
  );

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/timeline/courses', () => {
  it('returns the courses in the range with the school timezone', async () => {
    answer([{ id: 'c1', name: 'Matematică' }]);

    const res = await request(app)
      .get('/api/timeline/courses?from=2026-09-01&to=2027-01-31')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ timezone: 'Europe/Bucharest', courses: [{ id: 'c1', name: 'Matematică' }] });
    expect(query.mock.calls.find(([sql]) => sql.includes('FROM courses'))?.[1]).toEqual([
      's1',
      '2026-09-01',
      '2027-01-31',
    ]);
  });

  it.each([
    ['a missing date', '?from=2026-09-01'],
    ['an impossible date', '?from=2026-02-30&to=2026-03-01'],
    ['a reversed range', '?from=2026-10-01&to=2026-09-01'],
    ['a range over 400 days', '?from=2026-01-01&to=2027-06-01'],
  ])('returns 400 for %s', async (_case, qs) => {
    const res = await request(app).get(`/api/timeline/courses${qs}`).set('Authorization', auth());

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('is only for school admins', async () => {
    const res = await request(app)
      .get('/api/timeline/courses?from=2026-09-01&to=2026-09-30')
      .set('Authorization', auth('teacher'));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/timeline/lessons', () => {
  it('returns the lessons in the range', async () => {
    answer([{ id: 'l1', date: '2026-10-02', startTime: '08:00' }]);

    const res = await request(app)
      .get('/api/timeline/lessons?from=2026-10-02&to=2026-10-02')
      .set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.lessons).toEqual([{ id: 'l1', date: '2026-10-02', startTime: '08:00' }]);
  });

  it('allows at most six weeks', async () => {
    const res = await request(app)
      .get('/api/timeline/lessons?from=2026-10-01&to=2026-12-01')
      .set('Authorization', auth());

    expect(res.status).toBe(400);
  });
});
