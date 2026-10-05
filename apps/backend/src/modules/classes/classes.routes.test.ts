import express from 'express';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import classRoutes from './classes.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use(express.json()).use('/api/classes', classRoutes).use(errorHandler);

const CLASS_ID = '4f56eb0f-e710-4d30-bced-559ed7d54cdb';
const STUDENT_ID = 'd563b3c9-04b6-4efa-8d5b-7339416c286e';

const auth = (role: string, schoolId: string | null = 's1') =>
  `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: schoolId })}`;

const uniqueViolation = () => Object.assign(new DatabaseError('duplicate key', 0, 'error'), { code: '23505' });

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/classes', () => {
  it('lists the classes of the caller school', async () => {
    query.mockResolvedValue({ rows: [{ id: CLASS_ID, name: '9A', schoolYear: '2026-2027', studentsCount: 4 }] });

    const res = await request(app).get('/api/classes').set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1']);
  });

  it('returns 403 for students', async () => {
    const res = await request(app).get('/api/classes').set('Authorization', auth('student'));

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has no school', async () => {
    const res = await request(app).get('/api/classes').set('Authorization', auth('school_admin', null));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/classes/taught', () => {
  it('lists the classes a teacher teaches, with their students', async () => {
    query.mockResolvedValue({ rows: [{ id: CLASS_ID, name: '9A', students: [] }] });

    const res = await request(app).get('/api/classes/taught').set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', 'u1']);
  });

  it('is only for teachers', async () => {
    expect((await request(app).get('/api/classes/taught').set('Authorization', auth('school_admin'))).status).toBe(403);
  });
});

describe('POST /api/classes', () => {
  it('creates a class', async () => {
    query.mockResolvedValue({ rows: [{ id: CLASS_ID, name: '9A', schoolYear: '2026-2027' }] });

    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', auth('school_admin'))
      .send({ name: ' 9A ', schoolYear: '2026-2027' });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', '9A', '2026-2027']);
  });

  it('rejects a malformed school year', async () => {
    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', auth('school_admin'))
      .send({ name: '9A', schoolYear: '26-27' });

    expect(res.status).toBe(400);
  });

  it('returns 409 for a duplicate class', async () => {
    query.mockRejectedValue(uniqueViolation());

    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', auth('school_admin'))
      .send({ name: '9A', schoolYear: '2026-2027' });

    expect(res.status).toBe(409);
  });

  it('returns 403 for teachers', async () => {
    const res = await request(app).post('/api/classes').set('Authorization', auth('teacher')).send({ name: '9A', schoolYear: '2026-2027' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/classes/:id', () => {
  it('returns the class with its students and courses', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: CLASS_ID, name: '9A', schoolYear: '2026-2027' }] })
      .mockResolvedValueOnce({ rows: [{ id: STUDENT_ID, firstName: 'Ana' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1', name: 'Matematică' }] });

    const res = await request(app).get(`/api/classes/${CLASS_ID}`).set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(res.body.students).toEqual([{ id: STUDENT_ID, firstName: 'Ana' }]);
    expect(res.body.courses).toEqual([{ id: 'c1', name: 'Matematică' }]);
  });

  it('returns 404 for a class in another school', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get(`/api/classes/${CLASS_ID}`).set('Authorization', auth('teacher'));

    expect(res.status).toBe(404);
  });

  it('returns 404 for a malformed id without querying', async () => {
    const res = await request(app).get('/api/classes/not-a-uuid').set('Authorization', auth('teacher'));

    expect(res.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/classes/:id', () => {
  it('deletes a class of the admin school', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).delete(`/api/classes/${CLASS_ID}`).set('Authorization', auth('school_admin'));

    expect(res.status).toBe(204);
    expect(query.mock.calls[0]?.[1]).toEqual([CLASS_ID, 's1']);
  });

  it('is only for admins', async () => {
    expect((await request(app).delete(`/api/classes/${CLASS_ID}`).set('Authorization', auth('teacher'))).status).toBe(403);
  });
});

describe('POST /api/classes/:id/students', () => {
  const addStudent = () =>
    request(app).post(`/api/classes/${CLASS_ID}/students`).set('Authorization', auth('school_admin')).send({ studentId: STUDENT_ID });

  it('adds the student', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await addStudent();

    expect(res.status).toBe(201);
    expect(query.mock.calls[0]?.[1]).toEqual([CLASS_ID, STUDENT_ID, 's1']);
  });

  it('returns 404 when the class or student is not in the school', async () => {
    query.mockResolvedValue({ rowCount: 0 });

    expect((await addStudent()).status).toBe(404);
  });

  it('returns 409 when the student is already in the class', async () => {
    query.mockRejectedValue(uniqueViolation());

    expect((await addStudent()).status).toBe(409);
  });
});

describe('DELETE /api/classes/:id/students/:studentId', () => {
  it('removes the student', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).delete(`/api/classes/${CLASS_ID}/students/${STUDENT_ID}`).set('Authorization', auth('school_admin'));

    expect(res.status).toBe(204);
  });
});
