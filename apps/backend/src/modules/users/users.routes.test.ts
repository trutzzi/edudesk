import express from 'express';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import userRoutes from './users.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use(express.json()).use('/api/users', userRoutes).use(errorHandler);

const auth = (role = 'school_admin') => `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

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
      sql.startsWith('SELECT role') ? { rows: [{ role: 'student' }] } : { rows: [], rowCount: 0 },
    );

    const res = await request(app).delete(`/api/users/${MEMBER_ID}`).set('Authorization', auth());

    expect(res.status).toBe(204);
    expect(statements()).toEqual(['BEGIN', 'SELECT role', 'SELECT 1', 'DELETE FROM', 'DELETE FROM', 'UPDATE users', 'COMMIT']);
  });

  it('refuses a teacher who still has courses', async () => {
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT role') ? { rows: [{ role: 'teacher' }] } : { rows: [{}], rowCount: 3 },
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

const ABA = '0b1f3c5e-7a9d-4b2c-8e6f-1a3c5e7a9d4b';
const KINETO = '5d7f9b1d-3f5a-4c7e-9b1d-3f5a7c9e1b2d';

describe('POST /api/users', () => {
  const client = { query: vi.fn(), release: vi.fn() };
  const created = { id: 'n1', firstName: 'Irina', lastName: 'Pop', phone: '+40722111222', role: 'teacher' };
  const therapist = {
    role: 'teacher',
    firstName: 'Irina',
    lastName: 'Pop',
    phone: '0722 111 222',
    password: 'ab3k9m',
    specializations: [ABA],
  };
  const create = (body: object) => request(app).post('/api/users').set('Authorization', auth()).send(body);

  beforeEach(() => {
    client.query.mockReset();
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO users')
        ? { rows: [{ id: 'n1' }] }
        : sql.includes('SELECT u.id')
          ? { rows: [created] }
          : { rows: [], rowCount: 1 },
    );
    vi.mocked(pool.connect).mockImplementation(async () => client as never);
  });

  const insertParams = () =>
    client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO users'))?.[1] as unknown[] | undefined;

  it('creates a therapist with their phone in one form and their specializations', async () => {
    const res = await create(therapist);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
    expect(insertParams()?.slice(0, 6)).toEqual(['s1', 'teacher', 'Irina', 'Pop', null, '+40722111222']);
    const specializations = client.query.mock.calls.find(([sql]) => String(sql).startsWith('INSERT INTO therapist_specializations'));
    expect(specializations?.[1]).toEqual(['n1', 's1', [ABA]]);
  });

  it('creates a client with a payment type', async () => {
    const res = await create({ ...therapist, role: 'student', specializations: undefined, paymentType: 'sponsored' });

    expect(res.status).toBe(201);
    expect(insertParams()?.[1]).toBe('student');
    expect(insertParams()?.[7]).toBe('sponsored');
  });

  it.each([
    ['a parent', { role: 'parent' }],
    ['a bad phone', { phone: '123' }],
    ['a short password', { password: 'abc12' }],
    ['a therapy that is not an id', { specializations: ['Matematică'] }],
    ['a room for a therapist', { classId: '4f56eb0f-e710-4d30-bced-559ed7d54cdb' }],
    ['an unknown payment type', { role: 'student', paymentType: 'cash' }],
  ])('rejects %s', async (_case, change) => {
    expect((await create({ ...therapist, ...change })).status).toBe(400);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('returns 404 for a therapy of another institution', async () => {
    client.query.mockImplementation(async (sql: string) =>
      sql.includes('INSERT INTO users') ? { rows: [{ id: 'n1' }] } : { rows: [], rowCount: 0 },
    );

    expect((await create(therapist)).status).toBe(404);
  });

  it('returns 409 when the phone is taken', async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO users')) throw Object.assign(new DatabaseError('dup', 0, 'error'), { code: '23505' });
      return { rows: [] };
    });

    const res = await create(therapist);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONTACT_TAKEN');
  });

  it('is only for school admins', async () => {
    expect((await request(app).post('/api/users').set('Authorization', auth('teacher')).send(therapist)).status).toBe(403);
  });
});

describe('PATCH /api/users/:id', () => {
  const MEMBER_ID = 'd563b3c9-04b6-4efa-8d5b-7339416c286e';
  const client = { query: vi.fn(), release: vi.fn() };
  const patch = (body: object) => request(app).patch(`/api/users/${MEMBER_ID}`).set('Authorization', auth()).send(body);
  const withRole = (role: string) =>
    client.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT role')
        ? { rows: [{ role }] }
        : sql.includes('SELECT u.id')
          ? { rows: [{ id: MEMBER_ID }] }
          : // Every therapy id given belongs to the school
            { rows: [], rowCount: sql.includes('INSERT INTO therapist_specializations') ? 2 : 0 },
    );

  beforeEach(() => {
    client.query.mockReset();
    vi.mocked(pool.connect).mockImplementation(async () => client as never);
  });

  it("changes a therapist's phone and specializations", async () => {
    withRole('teacher');

    const res = await patch({ phone: '0722 999 888', specializations: [ABA, KINETO] });

    expect(res.status).toBe(200);
    const update = client.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE users'));
    expect(update?.[0]).toContain('phone = $2');
    expect(update?.[1]).toEqual([MEMBER_ID, '+40722999888']);
  });

  it('gives only clients a payment type', async () => {
    withRole('teacher');

    expect((await patch({ paymentType: 'cas' })).status).toBe(400);
  });

  it('returns 404 for someone outside the school', async () => {
    client.query.mockResolvedValue({ rows: [] });

    expect((await patch({ firstName: 'Ana' })).status).toBe(404);
  });
});
