import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { DatabaseError } from 'pg';
import { pool } from '../db.js';
import { generateToken } from '../utils/auth.js';
import { errorHandler } from '../middleware/errors.js';
import schoolRoutes from './schools.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const app = express().use(express.json()).use('/api/schools', schoolRoutes).use(errorHandler);

const auth = (role = 'school_admin') =>
  `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: null })}`;

const linkedUser = {
  id: 'u1',
  email: 'ana@school.edu',
  first_name: 'Ana',
  last_name: 'Pop',
  role: 'school_admin',
  school_id: 'new-school',
};

beforeEach(() => {
  client.query.mockReset();
  client.release.mockReset();
});

describe('POST /api/schools', () => {
  it('creates the school, links the admin and returns a token that knows the school', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT INTO schools')) return { rows: [{ id: 'new-school' }] };
      if (sql.startsWith('UPDATE users')) return { rows: [linkedUser] };
      return { rows: [] };
    });

    const res = await request(app)
      .post('/api/schools')
      .set('Authorization', auth())
      .send({ name: 'Liceul Teoretic', code: 'lt-cluj' });

    expect(res.status).toBe(201);
    expect(res.body.user.schoolId).toBe('new-school');
    expect(jwt.decode(res.body.token)).toMatchObject({ schoolId: 'new-school' });
    expect(client.query.mock.calls[1]?.[1]).toEqual(['Liceul Teoretic', 'LT-CLUJ', 'Europe/Bucharest']);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  });

  it('rolls back when the admin already has a school', async () => {
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('INSERT') ? { rows: [{ id: 'new-school' }] } : { rows: [] }
    );

    const res = await request(app).post('/api/schools').set('Authorization', auth()).send({ name: 'X', code: 'XYZ' });

    expect(res.status).toBe(409);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
  });

  it('returns 409 when the code is taken', async () => {
    const duplicate = Object.assign(new DatabaseError('duplicate', 0, 'error'), { code: '23505' });
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('INSERT')) throw duplicate;
      return { rows: [] };
    });

    const res = await request(app).post('/api/schools').set('Authorization', auth()).send({ name: 'X', code: 'DEMO' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SCHOOL_CODE_TAKEN');
  });

  it.each([
    ['a short code', { name: 'X', code: 'AB' }],
    ['an unknown time zone', { name: 'X', code: 'ABC', timezone: 'Mars/Olympus' }],
    ['a missing name', { code: 'ABC' }],
  ])('returns 400 for %s', async (_case, body) => {
    expect((await request(app).post('/api/schools').set('Authorization', auth()).send(body)).status).toBe(400);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('is only for school admins', async () => {
    const res = await request(app).post('/api/schools').set('Authorization', auth('teacher')).send({ name: 'X', code: 'ABC' });

    expect(res.status).toBe(403);
  });
});
