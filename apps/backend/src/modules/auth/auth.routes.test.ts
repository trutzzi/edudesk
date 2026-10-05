import express from 'express';
import { DatabaseError } from 'pg';
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

// The connection the sign-up transaction runs on
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

const validSignup = {
  email: 'ana@school.edu',
  password: 'password123',
  firstName: 'Ana',
  lastName: 'Pop',
  role: 'teacher',
};

// Fewer accounts from this IP than the limit, then the transaction succeeds
function allowSignup(accountsFromIp = 0) {
  query.mockResolvedValue({ rows: [{ count: accountsFromIp }] });
  client.query.mockImplementation(async (sql: string) =>
    sql.includes('INSERT INTO users') ? { rows: [{ ...userRow, email_verified_at: null }] } : { rows: [] },
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const emailedLink = () => vi.mocked(sendMail).mock.calls[0]?.[0].text.match(/token=(\S+)/)?.[1];

beforeEach(() => {
  vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', 'true');
  query.mockReset();
  client.query.mockReset();
  client.release.mockReset();
  vi.mocked(sendMail).mockReset();
});

describe('POST /api/auth/register without email verification (the default)', () => {
  beforeEach(() => {
    vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', '');
  });

  it('creates a verified user and signs them in straight away', async () => {
    query.mockResolvedValue({ rows: [{ count: 0 }] });
    client.query.mockImplementation(async (sql: string) => (sql.includes('INSERT INTO users') ? { rows: [userRow] } : { rows: [] }));

    const res = await request(app).post('/api/auth/register').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('ana@school.edu');
    const insert = client.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO users'));
    expect(insert?.[1].at(-1)).toBe(false); // not waiting for verification
    expect(client.query.mock.calls.some(([sql]) => sql.includes('email_verification_tokens'))).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('lets unverified accounts sign in', async () => {
    query.mockResolvedValue({
      rows: [{ ...userRow, email_verified_at: null, password_hash: await hashPassword('password123') }],
    });

    const res = await request(app).post('/api/auth/login').send({ email: 'ana@school.edu', password: 'password123' });

    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/register with email verification', () => {
  it('creates an unverified user and emails a confirmation link', async () => {
    allowSignup();

    const res = await request(app).post('/api/auth/register').send(validSignup);

    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@school.edu' }));
    // The database only gets the hash of the emailed token
    const storedHash = client.query.mock.calls.find(([sql]) => sql.includes('email_verification_tokens ('))?.[1][0];
    expect(storedHash).toBe(sha256(decodeURIComponent(emailedLink()!)));
    expect(client.release).toHaveBeenCalled();
  });

  it('writes the email in the chosen language', async () => {
    allowSignup();

    await request(app)
      .post('/api/auth/register')
      .send({ ...validSignup, locale: 'ro' });

    expect(vi.mocked(sendMail).mock.calls[0]?.[0].subject).toBe('Confirmă-ți contul EduDesk');
  });

  it('pretends to succeed when the honeypot is filled, without creating anything', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validSignup, website: 'http://spam.example' });

    expect(res.status).toBe(201);
    expect(query).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns 429 when this IP created too many accounts today', async () => {
    allowSignup(5);

    const res = await request(app).post('/api/auth/register').send(validSignup);

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('TOO_MANY_ACCOUNTS');
    expect(client.query).not.toHaveBeenCalled();
  });

  it('returns 400 when a field is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validSignup, firstName: '' });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 400 when the password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validSignup, password: 'short' });

    expect(res.status).toBe(400);
  });

  it('does not allow signing up as super admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validSignup, role: 'super_admin' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid role');
  });

  it('rolls back and returns 409 when the email is taken', async () => {
    query.mockResolvedValue({ rows: [{ count: 0 }] });
    const duplicate = new DatabaseError('duplicate key', 0, 'error');
    duplicate.code = '23505';
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO users')) throw duplicate;
      return { rows: [] };
    });

    const res = await request(app).post('/api/auth/register').send(validSignup);

    expect(res.status).toBe(409);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(sendMail).not.toHaveBeenCalled();
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
