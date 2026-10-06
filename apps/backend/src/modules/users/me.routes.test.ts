import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { hashPassword } from '../../lib/password.js';
import { generateToken } from '../../lib/session.js';
import meRoutes from './me.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;
const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const app = express().use(express.json()).use('/api/me', meRoutes).use(errorHandler);
const auth = (role = 'teacher') => `Bearer ${generateToken({ id: 'u1', email: null, role, school_id: 's1' })}`;

const ABA = '0b1f3c5e-7a9d-4b2c-8e6f-1a3c5e7a9d4b';
const profile = {
  id: 'u1',
  firstName: 'Ana',
  lastName: 'Pop',
  role: 'teacher',
  locale: 'ro',
  details: null,
  notes: null,
  specializations: [],
};
const update = () => client.query.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE users'));

beforeEach(() => {
  query.mockReset();
  client.query.mockReset();
  client.query.mockImplementation(async (sql: string) =>
    sql.includes('SELECT u.id')
      ? { rows: [profile] }
      : { rows: [], rowCount: sql.includes('INSERT INTO therapist_specializations') ? 1 : 0 },
  );
});

describe('own profile', () => {
  it('shows the signed-in person their profile', async () => {
    query.mockResolvedValue({ rows: [profile] });

    const res = await request(app).get('/api/me').set('Authorization', auth('student'));

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual(['u1']);
  });

  it('saves the language, details and notes', async () => {
    const res = await request(app).patch('/api/me').set('Authorization', auth()).send({ locale: 'en', details: ' 10 ani ABA ', notes: '' });

    expect(res.status).toBe(200);
    expect(update()?.[0]).toContain('locale = $2, details = $3, notes = $4');
    expect(update()?.[1]).toEqual(['u1', 'en', '10 ani ABA', null]);
  });

  it("sets a therapist's own specializations", async () => {
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', auth())
      .send({ specializations: [ABA] });

    expect(res.status).toBe(200);
    const saved = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO therapist_specializations'));
    expect(saved?.[1]).toEqual(['u1', 's1', [ABA]]);
  });

  it.each([
    ['specializations for a client', 'student', { specializations: [ABA] }],
    ['an unknown language', 'teacher', { locale: 'fr' }],
    ['an empty name', 'teacher', { firstName: ' ' }],
  ])('rejects %s', async (_case, role, body) => {
    expect((await request(app).patch('/api/me').set('Authorization', auth(role)).send(body)).status).toBe(400);
    expect(update()).toBeUndefined();
  });
});

describe('PUT /api/me/password', () => {
  it('changes the password when the current one is right', async () => {
    query.mockResolvedValue({ rows: [{ password_hash: await hashPassword('vechi1') }] });

    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', auth())
      .send({ currentPassword: 'vechi1', newPassword: 'nou234' });

    expect(res.status).toBe(204);
    expect(update()?.[0]).toContain('password_hash = $2');
  });

  it('refuses a wrong current password', async () => {
    query.mockResolvedValue({ rows: [{ password_hash: await hashPassword('vechi1') }] });

    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', auth())
      .send({ currentPassword: 'gresit', newPassword: 'nou234' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WRONG_PASSWORD');
    expect(update()).toBeUndefined();
  });
});
