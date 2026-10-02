import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../db.js';
import { generateToken } from '../utils/auth.js';
import { errorHandler } from '../middleware/errors.js';
import userRoutes from './users.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use('/api/users', userRoutes).use(errorHandler);

const auth = (role = 'school_admin') =>
  `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/users', () => {
  it('lists people of one role in the admin school', async () => {
    query.mockResolvedValue({ rows: [{ id: 'u2', firstName: 'Ioana' }] });

    const res = await request(app).get('/api/users?role=student').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', 'student']);
  });

  it('lists everyone in the school without a role', async () => {
    query.mockResolvedValue({ rows: [] });

    await request(app).get('/api/users').set('Authorization', auth());

    expect(query.mock.calls[0]?.[1]).toEqual(['s1', null]);
  });

  it('rejects unknown roles', async () => {
    expect((await request(app).get('/api/users?role=super_admin').set('Authorization', auth())).status).toBe(400);
  });

  it('is only for school admins', async () => {
    expect((await request(app).get('/api/users?role=student').set('Authorization', auth('teacher'))).status).toBe(403);
  });
});

describe('DELETE /api/users/:id', () => {
  const MEMBER_ID = 'd563b3c9-04b6-4efa-8d5b-7339416c286e';
  const client = { query: vi.fn(), release: vi.fn() };
  const statements = () => client.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/).slice(0, 2).join(' '));

  beforeEach(() => {
    client.query.mockReset();
    vi.mocked(pool.connect).mockImplementation(async () => client as never);
  });

  it('unlinks the person and their class and family links, keeping the account', async () => {
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT role') ? { rows: [{ role: 'student' }] } : { rows: [], rowCount: 0 }
    );

    const res = await request(app).delete(`/api/users/${MEMBER_ID}`).set('Authorization', auth());

    expect(res.status).toBe(204);
    expect(statements()).toEqual(['BEGIN', 'SELECT role', 'SELECT 1', 'DELETE FROM', 'DELETE FROM', 'UPDATE users', 'COMMIT']);
  });

  it('refuses a teacher who still has courses', async () => {
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT role') ? { rows: [{ role: 'teacher' }] } : { rows: [{}], rowCount: 3 }
    );

    const res = await request(app).delete(`/api/users/${MEMBER_ID}`).set('Authorization', auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TEACHER_HAS_COURSES');
    expect(statements().at(-1)).toBe('ROLLBACK');
  });

  it('refuses removing yourself', async () => {
    const self = `Bearer ${generateToken({ id: MEMBER_ID, email: 'a@b.ro', role: 'school_admin', school_id: 's1' })}`;

    const res = await request(app).delete(`/api/users/${MEMBER_ID}`).set('Authorization', self);

    expect(res.status).toBe(400);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('returns 404 for someone in another school', async () => {
    client.query.mockResolvedValue({ rows: [] });

    expect((await request(app).delete(`/api/users/${MEMBER_ID}`).set('Authorization', auth())).status).toBe(404);
  });
});
