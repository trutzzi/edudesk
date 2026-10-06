import express from 'express';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { sendMail } from '../../emails/mailer.js';
import { errorHandler } from '../../http/errors.js';
import { hashPassword } from '../../lib/password.js';
import { generateToken } from '../../lib/session.js';
import { sha256 } from '../../lib/tokens.js';
import invitationRoutes from './invitations.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../../emails/mailer.js', () => ({ sendMail: vi.fn() }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;
const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const app = express().use(express.json()).use('/api/invitations', invitationRoutes).use(errorHandler);

const CLASS_ID = '4f56eb0f-e710-4d30-bced-559ed7d54cdb';
const STUDENT_ID = 'd563b3c9-04b6-4efa-8d5b-7339416c286e';
const INVITATION_ID = 'ef7468ad-d23d-4e1b-bf1c-a3a272e70a96';

const auth = (role = 'school_admin') => `Bearer ${generateToken({ id: 'admin1', email: 'admin@school.edu', role, school_id: 's1' })}`;

// Answers the admin-side queries by what they look for
function answerAdminQueries({ existingSchool = undefined as string | null | undefined, inserted = true } = {}) {
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT school_id FROM users')) {
      return { rows: existingSchool === undefined ? [] : [{ school_id: existingSchool }] };
    }
    if (sql.includes('INSERT INTO invitations')) return { rows: inserted ? [{ id: INVITATION_ID }] : [] };
    if (sql.includes('AS inviter')) return { rows: [{ inviter: 'Ana Pop', school: 'Liceul Demo' }] };
    return { rows: [] };
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

const emailedToken = () => vi.mocked(sendMail).mock.calls[0]?.[0].text.match(/token=(\S+)/)?.[1];

beforeEach(() => {
  query.mockReset();
  client.query.mockReset();
  client.release.mockReset();
  vi.mocked(sendMail).mockReset();
});

describe('POST /api/invitations', () => {
  const invite = (body: object, role?: string) => request(app).post('/api/invitations').set('Authorization', auth(role)).send(body);

  it('stores only the token hash and emails the link', async () => {
    answerAdminQueries();

    const res = await invite({ email: ' Elena@School.edu ', role: 'teacher', locale: 'ro' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: INVITATION_ID, email: 'elena@school.edu', role: 'teacher' });
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO invitations'))!;
    expect(insert[1][5]).toBe(sha256(decodeURIComponent(emailedToken()!)));
    expect(vi.mocked(sendMail).mock.calls[0]?.[0]).toMatchObject({
      to: 'elena@school.edu',
      subject: 'Ai fost invitat la Liceul Demo pe Blue',
    });
  });

  it('can place a student straight into a class', async () => {
    answerAdminQueries();

    const res = await invite({ email: 'radu@school.edu', role: 'student', classId: CLASS_ID });

    expect(res.status).toBe(201);
    expect(query.mock.calls.find(([sql]) => sql.includes('INSERT INTO invitations'))![1][3]).toBe(CLASS_ID);
  });

  it.each([
    ['a class for a teacher', { email: 'a@b.ro', role: 'teacher', classId: CLASS_ID }],
    ['a child for a student', { email: 'a@b.ro', role: 'student', studentId: STUDENT_ID }],
    ['a super admin', { email: 'a@b.ro', role: 'super_admin' }],
    ['a malformed email', { email: 'not-an-email', role: 'teacher' }],
  ])('rejects %s', async (_case, body) => {
    expect((await invite(body)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses people already in this school or another', async () => {
    answerAdminQueries({ existingSchool: 's1' });
    expect((await invite({ email: 'a@b.ro', role: 'teacher' })).body.code).toBe('ALREADY_MEMBER');

    answerAdminQueries({ existingSchool: 's2' });
    expect((await invite({ email: 'a@b.ro', role: 'teacher' })).body.code).toBe('IN_OTHER_SCHOOL');
  });

  it('invites people who signed up without a school', async () => {
    answerAdminQueries({ existingSchool: null });

    expect((await invite({ email: 'a@b.ro', role: 'teacher' })).status).toBe(201);
  });

  it('returns 404 for a class of another school', async () => {
    answerAdminQueries({ inserted: false });

    expect((await invite({ email: 'a@b.ro', role: 'student', classId: CLASS_ID })).status).toBe(404);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('points to resending when an invitation is already pending', async () => {
    answerAdminQueries();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO invitations')) throw Object.assign(new DatabaseError('dup', 0, 'error'), { code: '23505' });
      return { rows: [] };
    });

    const res = await invite({ email: 'a@b.ro', role: 'teacher' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVITATION_PENDING');
  });

  it('is not for students or parents', async () => {
    expect((await invite({ email: 'a@b.ro', role: 'student' }, 'student')).status).toBe(403);
  });
});

describe('teachers inviting students', () => {
  const teacherAuth = () => `Bearer ${generateToken({ id: 't1', email: 't@school.ro', role: 'teacher', school_id: 's1' })}`;
  const invite = (body: object) => request(app).post('/api/invitations').set('Authorization', teacherAuth()).send(body);

  it('invites a student into a class they teach', async () => {
    answerAdminQueries();

    const res = await invite({ email: 'radu@school.ro', role: 'student', classId: CLASS_ID });

    expect(res.status).toBe(201);
    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO invitations'))!;
    expect(insert[0]).toContain('teacher_id = $9::uuid');
    expect(insert[1].at(-1)).toBe('t1');
  });

  it('refuses a class they do not teach', async () => {
    answerAdminQueries({ inserted: false });

    const res = await invite({ email: 'radu@school.ro', role: 'student', classId: CLASS_ID });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('You do not teach this class');
  });

  it.each([
    ['another teacher', { email: 'a@b.ro', role: 'teacher' }],
    ['a student without a class', { email: 'a@b.ro', role: 'student' }],
  ])('cannot invite %s', async (_case, body) => {
    const res = await invite(body);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('TEACHERS_INVITE_STUDENTS');
    expect(query).not.toHaveBeenCalled();
  });

  it('only lists and revokes the invitations they sent', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 1 });

    await request(app).get('/api/invitations').set('Authorization', teacherAuth());
    await request(app).delete(`/api/invitations/${INVITATION_ID}`).set('Authorization', teacherAuth());

    expect(query.mock.calls[0]?.[1]).toEqual(['s1', 't1']);
    expect(query.mock.calls[1]?.[1]).toEqual([INVITATION_ID, 's1', 't1']);
  });
});

describe('managing invitations', () => {
  it('resends with a new token', async () => {
    query.mockImplementation(async (sql: string) =>
      sql.startsWith('UPDATE invitations')
        ? { rows: [{ email: 'a@b.ro', role: 'teacher' }] }
        : { rows: [{ inviter: 'Ana Pop', school: 'Liceul Demo' }] },
    );

    const res = await request(app).post(`/api/invitations/${INVITATION_ID}/resend`).set('Authorization', auth());

    expect(res.status).toBe(204);
    const update = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE invitations'))!;
    expect(update[1][2]).toBe(sha256(decodeURIComponent(emailedToken()!)));
  });

  it('revokes a pending invitation', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).delete(`/api/invitations/${INVITATION_ID}`).set('Authorization', auth());

    expect(res.status).toBe(204);
    expect(query.mock.calls[0]?.[1]).toEqual([INVITATION_ID, 's1', null]);
  });

  it('returns 404 when revoking an unknown invitation', async () => {
    query.mockResolvedValue({ rowCount: 0 });

    expect((await request(app).delete(`/api/invitations/${INVITATION_ID}`).set('Authorization', auth())).status).toBe(404);
  });
});

describe('GET /api/invitations/lookup', () => {
  it('describes a valid invitation without signing in', async () => {
    query.mockResolvedValue({ rows: [{ email: 'a@b.ro', role: 'teacher', schoolName: 'Liceul Demo', hasAccount: false }] });

    const res = await request(app).get('/api/invitations/lookup?token=abc');

    expect(res.status).toBe(200);
    expect(res.body.schoolName).toBe('Liceul Demo');
    expect(query.mock.calls[0]?.[1]).toEqual([sha256('abc')]);
  });

  it('returns 404 for a used or expired link', async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await request(app).get('/api/invitations/lookup?token=abc');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVALID_INVITATION');
  });
});

describe('POST /api/invitations/accept', () => {
  const invitation = {
    id: INVITATION_ID,
    school_id: 's1',
    email: 'radu@school.edu',
    role: 'student',
    class_id: CLASS_ID,
    student_id: null,
  };
  const member = { id: 'u9', email: 'radu@school.edu', first_name: 'Radu', last_name: 'Marin', role: 'student', school_id: 's1' };

  // Answers the transaction's queries; `existing` is the account already using the invited email, if any
  function answerAccept(existing?: object) {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM invitations')) return { rows: [invitation] };
      if (sql.startsWith('SELECT * FROM users')) return { rows: existing ? [existing] : [] };
      if (sql.startsWith('INSERT INTO users') || sql.startsWith('UPDATE users')) return { rows: [member] };
      return { rows: [] };
    });
  }
  const statements = () => client.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/).slice(0, 3).join(' '));

  it('creates the account, puts the student in the class and signs them in', async () => {
    answerAccept();

    const res = await request(app)
      .post('/api/invitations/accept')
      .send({ token: 'abc', firstName: 'Radu', lastName: 'Marin', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'radu@school.edu', schoolId: 's1' });
    expect(statements()).toEqual([
      'BEGIN',
      'SELECT id, school_id,',
      'SELECT * FROM',
      'INSERT INTO users',
      'INSERT INTO class_students',
      'UPDATE invitations SET',
      'COMMIT',
    ]);
  });

  it('links an existing account after checking its password', async () => {
    answerAccept({ ...member, school_id: null, password_hash: await hashPassword('password123') });

    const res = await request(app).post('/api/invitations/accept').send({ token: 'abc', password: 'password123' });

    expect(res.status).toBe(200);
    expect(statements()).toContain('UPDATE users SET');
  });

  it('rolls back on a wrong password', async () => {
    answerAccept({ ...member, school_id: null, password_hash: await hashPassword('password123') });

    const res = await request(app).post('/api/invitations/accept').send({ token: 'abc', password: 'nope-nope' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('WRONG_PASSWORD');
    expect(statements().at(-1)).toBe('ROLLBACK');
  });

  it('refuses an account that belongs to another school', async () => {
    answerAccept({ ...member, school_id: 's2', password_hash: await hashPassword('password123') });

    const res = await request(app).post('/api/invitations/accept').send({ token: 'abc', password: 'password123' });

    expect(res.status).toBe(409);
    expect(statements().at(-1)).toBe('ROLLBACK');
  });

  it('returns 404 for a used or expired link', async () => {
    client.query.mockResolvedValue({ rows: [] });

    const res = await request(app).post('/api/invitations/accept').send({ token: 'abc', password: 'password123' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVALID_INVITATION');
  });

  it('needs a name and a long enough password for a new account', async () => {
    answerAccept();

    expect((await request(app).post('/api/invitations/accept').send({ token: 'abc', password: 'password123' })).status).toBe(400);
    expect(
      (await request(app).post('/api/invitations/accept').send({ token: 'abc', firstName: 'R', lastName: 'M', password: 'short' })).status,
    ).toBe(400);
  });
});

describe('accepting in the app', () => {
  const account = {
    id: 'u7',
    email: 'Alina@School.ro',
    first_name: 'Alina',
    last_name: 'Georgescu',
    role: 'teacher',
    school_id: null,
    email_verified_at: new Date(),
  };
  const invitation = { id: INVITATION_ID, school_id: 's1', email: 'alina@school.ro', role: 'teacher', class_id: null, student_id: null };
  const signedIn = () => `Bearer ${generateToken({ id: 'u7', email: 'alina@school.ro', role: 'teacher', school_id: null })}`;
  const statements = () => client.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/).slice(0, 3).join(' '));

  function answer({ me = account, found = true }: { me?: object; found?: boolean } = {}) {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith('SELECT * FROM users')) return { rows: [me] };
      if (sql.includes('FROM invitations')) return { rows: found ? [invitation] : [] };
      if (sql.startsWith('UPDATE users')) return { rows: [{ ...account, school_id: 's1' }] };
      return { rows: [] };
    });
  }

  it('lists the invitations for my email', async () => {
    query.mockResolvedValue({ rows: [{ id: INVITATION_ID, role: 'teacher', schoolName: 'Astra Pitesti' }] });

    const res = await request(app).get('/api/invitations/mine').set('Authorization', signedIn());

    expect(res.status).toBe(200);
    expect(res.body[0].schoolName).toBe('Astra Pitesti');
    expect(query.mock.calls[0]?.[1]).toEqual(['u7']);
  });

  it('needs to be signed in', async () => {
    expect((await request(app).get('/api/invitations/mine')).status).toBe(401);
  });

  it('joins the school without a password and returns a token that knows the school', async () => {
    answer();

    const res = await request(app).post(`/api/invitations/mine/${INVITATION_ID}/accept`).set('Authorization', signedIn());

    expect(res.status).toBe(200);
    expect(res.body.user.schoolId).toBe('s1');
    // The invitation must be addressed to this account's email
    const lookup = client.query.mock.calls.find(([sql]) => String(sql).includes('FROM invitations'))!;
    expect(lookup[1]).toEqual([INVITATION_ID, 'Alina@School.ro']);
    expect(statements()).toEqual([
      'BEGIN',
      'SELECT * FROM',
      'SELECT id, school_id,',
      'UPDATE users SET',
      'UPDATE invitations SET',
      'COMMIT',
    ]);
  });

  it("refuses someone else's invitation", async () => {
    answer({ found: false });

    const res = await request(app).post(`/api/invitations/mine/${INVITATION_ID}/accept`).set('Authorization', signedIn());

    expect(res.status).toBe(404);
    expect(statements().at(-1)).toBe('ROLLBACK');
  });

  it('accepts unconfirmed accounts while email verification is off', async () => {
    answer({ me: { ...account, email_verified_at: null } });

    const res = await request(app).post(`/api/invitations/mine/${INVITATION_ID}/accept`).set('Authorization', signedIn());

    expect(res.status).toBe(200);
  });

  it('refuses unconfirmed accounts when email verification is on', async () => {
    vi.stubEnv('REQUIRE_EMAIL_VERIFICATION', 'true');
    answer({ me: { ...account, email_verified_at: null } });

    const res = await request(app).post(`/api/invitations/mine/${INVITATION_ID}/accept`).set('Authorization', signedIn());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('refuses accounts that belong to another school', async () => {
    answer({ me: { ...account, school_id: 's2' } });

    const res = await request(app).post(`/api/invitations/mine/${INVITATION_ID}/accept`).set('Authorization', signedIn());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('IN_OTHER_SCHOOL');
  });
});
