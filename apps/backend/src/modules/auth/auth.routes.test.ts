import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { sendMail } from '../../emails/mailer.js';
import { errorHandler } from '../../http/errors.js';
import { hashPassword } from '../../lib/password.js';
import { sha256 } from '../../lib/tokens.js';
import authRoutes from './auth.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../../emails/mailer.js', () => ({ sendMail: vi.fn() }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const app = express().use(express.json()).use('/api/auth', authRoutes).use(errorHandler);

const userRow = {
  id: 'u1',
  email: 'ana@school.edu',
  password_hash: '',
  first_name: 'Ana',
  last_name: 'Pop',
  role: 'teacher',
  school_id: null,
  email_verified_at: new Date(),
};

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', 'true');
  query.mockReset();
  client.query.mockReset();
  client.release.mockReset();
  vi.mocked(sendMail).mockReset();
});

describe('POST /api/auth/register', () => {
  it('no longer exists: accounts come from the create-admin script and from admins', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'ana@school.edu', password: 'password123' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/auth/verify-email', () => {
  it('verifies the user and signs them in', async () => {
    query.mockResolvedValue({ rows: [userRow] });

    const res = await request(app).post('/api/auth/verify-email').send({ token: 'abc' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(query.mock.calls[0]?.[1]).toEqual([sha256('abc')]);
  });

  it('returns 400 for an unknown, used or expired token', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/auth/verify-email').send({ token: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TOKEN');
  });
});

describe('POST /api/auth/resend-verification', () => {
  it('sends a new link to an unverified account', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...userRow, email_verified_at: null }] }).mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'ana@school.edu' });

    expect(res.status).toBe(200);
    expect(sendMail).toHaveBeenCalled();
  });

  it('gives the same answer when there is no such account', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@school.edu' });

    expect(res.status).toBe(200);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth/login', () => {
  it('returns a session for valid credentials', async () => {
    query.mockResolvedValue({ rows: [{ ...userRow, password_hash: await hashPassword('password123') }] });

    const res = await request(app).post('/api/auth/login').send({ email: 'ANA@school.edu', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ana@school.edu');
    expect(query.mock.calls[0]?.[1]).toEqual(['ana@school.edu']);
  });

  it('signs in with the phone number the admin saved, however it is typed', async () => {
    query.mockResolvedValue({
      rows: [{ ...userRow, email: null, phone: '+40722111222', password_hash: await hashPassword('password123') }],
    });

    const res = await request(app).post('/api/auth/login').send({ email: '0722 111 222', password: 'password123' });

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[0]).toContain('WHERE phone = $1');
    expect(query.mock.calls[0]?.[1]).toEqual(['+40722111222']);
  });

  it('returns 403 until the email is verified', async () => {
    query.mockResolvedValue({
      rows: [{ ...userRow, email_verified_at: null, password_hash: await hashPassword('password123') }],
    });

    const res = await request(app).post('/api/auth/login').send({ email: 'ana@school.edu', password: 'password123' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('returns 401 for an unknown email', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@school.edu', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong password', async () => {
    query.mockResolvedValue({ rows: [{ ...userRow, password_hash: await hashPassword('password123') }] });

    const res = await request(app).post('/api/auth/login').send({ email: 'ana@school.edu', password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when fields are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({});

    expect(res.status).toBe(400);
  });
});
