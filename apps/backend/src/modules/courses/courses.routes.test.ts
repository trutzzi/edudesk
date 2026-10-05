import express from 'express';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import courseRoutes from './courses.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

// The connection a transaction runs on: BEGIN, the queries, then COMMIT or ROLLBACK
const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const pgError = (code: string) => Object.assign(new DatabaseError('error', 0, 'error'), { code });

const app = express().use(express.json()).use('/api/courses', courseRoutes).use(errorHandler);

const CLASS_ID = '4f56eb0f-e710-4d30-bced-559ed7d54cdb';
const TEACHER_ID = '6e98e320-6cf3-4417-98bb-fe1a29bea773';

const auth = (role: string) => `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

const validCourse = { name: 'Matematică', classId: CLASS_ID, teacherId: TEACHER_ID };

beforeEach(() => {
  query.mockReset();
  client.query.mockReset();
  client.release.mockReset();
});

describe('GET /api/courses', () => {
  it.each([
    ['school_admin', 'cl.school_id = $1', ['s1']],
    ['teacher', 'co.teacher_id = $1', ['u1']],
    ['student', 'FROM class_students WHERE student_id = $1', ['u1']],
    ['parent', 'ps.parent_id = $1', ['u1']],
  ])('scopes the courses for a %s', async (role, where, params) => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/courses').set('Authorization', auth(role));

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[0]).toContain(where);
    expect(query.mock.calls[0]?.[1]).toEqual(params);
  });

  it('returns 401 without a token', async () => {
    expect((await request(app).get('/api/courses')).status).toBe(401);
  });
});

describe('POST /api/courses', () => {
  it('creates the course', async () => {
    query.mockResolvedValue({ rows: [{ id: 'c1', ...validCourse, description: null }] });

    const res = await request(app).post('/api/courses').set('Authorization', auth('school_admin')).send(validCourse);

    expect(res.status).toBe(201);
    expect(query.mock.calls[0]?.[1]).toEqual([CLASS_ID, TEACHER_ID, 'Matematică', null, 's1', null, null]);
  });

  it('returns 404 when the class or teacher is not in the school', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/courses').set('Authorization', auth('school_admin')).send(validCourse);

    expect(res.status).toBe(404);
  });

  it('returns 409 when the class already has that course', async () => {
    query.mockRejectedValue(pgError('23505'));

    const res = await request(app).post('/api/courses').set('Authorization', auth('school_admin')).send(validCourse);

    expect(res.status).toBe(409);
  });

  it('returns 400 when a field is missing', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', auth('school_admin'))
      .send({ ...validCourse, teacherId: undefined });

    expect(res.status).toBe(400);
  });

  it('returns 403 for teachers', async () => {
    const res = await request(app).post('/api/courses').set('Authorization', auth('teacher')).send(validCourse);

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/courses/:id', () => {
  const COURSE_ID = '92bb35ba-b8b2-4601-bdb5-8f6b9bf729c6';
  const patch = (body: object) => request(app).patch(`/api/courses/${COURSE_ID}`).set('Authorization', auth('school_admin')).send(body);

  it('only changes the fields that were sent', async () => {
    query.mockResolvedValue({ rows: [{ id: COURSE_ID, endDate: '2027-06-12' }] });

    const res = await patch({ endDate: '2027-06-12' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual([COURSE_ID, null, false, null, null, null, '2027-06-12', 's1']);
  });

  it('rejects an invalid date', async () => {
    expect((await patch({ startDate: '2027-02-30' })).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 400 when the end date is before the start date', async () => {
    query.mockRejectedValue(pgError('23514'));

    expect((await patch({ endDate: '2020-01-01' })).status).toBe(400);
  });

  it('returns 409 when new dates make its lessons clash', async () => {
    query.mockRejectedValue(pgError('23P01'));

    expect((await patch({ startDate: '2026-09-01' })).status).toBe(409);
  });

  it('returns 404 when the course is not in the school', async () => {
    query.mockResolvedValue({ rows: [] });

    expect((await patch({ name: 'Algebră' })).status).toBe(404);
  });
});

describe('PUT /api/courses/:id/lessons', () => {
  const COURSE_ID = '92bb35ba-b8b2-4601-bdb5-8f6b9bf729c6';
  const monday = { weekday: 1, startTime: '08:00', endTime: '08:50', room: 'Sala 101' };
  const put = (lessons: unknown) =>
    request(app).put(`/api/courses/${COURSE_ID}/lessons`).set('Authorization', auth('school_admin')).send({ lessons });
  const sql = () => client.query.mock.calls.map(([text]) => String(text).trim().split(/\s+/)[0]);

  it('replaces the schedule in one transaction', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // SELECT ... FOR UPDATE
      .mockResolvedValueOnce({}) // DELETE
      .mockResolvedValueOnce({ rows: [{ id: 'l1', weekday: 1, startTime: '08:00', endTime: '08:50' }] }) // INSERT
      .mockResolvedValueOnce({}); // COMMIT

    const res = await put([monday]);

    expect(res.status).toBe(200);
    expect(sql()).toEqual(['BEGIN', 'SELECT', 'DELETE', 'INSERT', 'COMMIT']);
    expect(JSON.parse(client.query.mock.calls[3]?.[1][1])).toEqual([
      { weekday: 1, start_time: '08:00', end_time: '08:50', room: 'Sala 101' },
    ]);
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and returns 409 on a clash', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(pgError('23P01'))
      .mockResolvedValueOnce({});

    const res = await put([monday]);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LESSON_CLASH');
    expect(sql().at(-1)).toBe('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  it('returns 404 when the course is not in the school', async () => {
    client.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({});

    expect((await put([monday])).status).toBe(404);
    expect(sql()).toEqual(['BEGIN', 'SELECT', 'ROLLBACK']);
  });

  it.each([
    ['a weekday out of range', [{ ...monday, weekday: 8 }]],
    ['an end before the start', [{ ...monday, endTime: '07:00' }]],
    ['a missing list', undefined],
  ])('rejects %s without touching the database', async (_case, lessons) => {
    expect((await put(lessons)).status).toBe(400);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/courses/:id', () => {
  const COURSE_ID = '92bb35ba-b8b2-4601-bdb5-8f6b9bf729c6';

  it('deletes a course of the admin school', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).delete(`/api/courses/${COURSE_ID}`).set('Authorization', auth('school_admin'));

    expect(res.status).toBe(204);
    expect(query.mock.calls[0]?.[1]).toEqual([COURSE_ID, 's1']);
  });

  it('returns 404 for another school or a bad id', async () => {
    query.mockResolvedValue({ rowCount: 0 });

    expect((await request(app).delete(`/api/courses/${COURSE_ID}`).set('Authorization', auth('school_admin'))).status).toBe(404);
    expect((await request(app).delete('/api/courses/nope').set('Authorization', auth('school_admin'))).status).toBe(404);
  });
});
