import express, { type Request, type Response } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import { invitationEmail } from '../emails/invitation.js';
import { toEmailLocale, type EmailLocale } from '../emails/layout.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { comparePassword, hashPassword, toSession } from '../utils/auth.js';
import { sendMail } from '../utils/mailer.js';
import { appLink, newLinkToken, sha256 } from '../utils/tokens.js';
import { withTransaction } from '../utils/transaction.js';
import { emailVerificationRequired } from '../utils/verification.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../utils/validation.js';

const router = express.Router();

const INVITATION_TTL_DAYS = 7;
const MIN_PASSWORD_LENGTH = 8;
const INVITABLE_ROLES = ['school_admin', 'teacher', 'student', 'parent'] as const;
type InvitableRole = (typeof INVITABLE_ROLES)[number];

// Deliberately loose: the real check is whether the person receives the email
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isInvitableRole = (value: unknown): value is InvitableRole => INVITABLE_ROLES.includes(value as InvitableRole);

const invalidInvitation = () =>
  new HttpError(404, 'This invitation is invalid, already used or expired', 'INVALID_INVITATION');

interface InvitationRow {
  id: string;
  school_id: string;
  email: string;
  role: InvitableRole;
  class_id: string | null;
  student_id: string | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string | null;
  email_verified_at: Date | null;
}

// Sends (or re-sends) an invitation email. A failed send is logged, not fatal: the admin can resend.
async function sendInvitation(invitation: { email: string; role: InvitableRole }, token: string, adminId: string, locale: EmailLocale) {
  const { rows } = await pool.query<{ inviter: string; school: string }>(
    `SELECT u.first_name || ' ' || u.last_name AS inviter, s.name AS school
     FROM users u JOIN schools s ON s.id = u.school_id
     WHERE u.id = $1`,
    [adminId]
  );
  const { inviter, school } = rows[0]!;
  try {
    await sendMail(
      invitationEmail({ to: invitation.email, inviter, school, role: invitation.role, link: appLink('/invite', token), locale })
    );
  } catch (err) {
    console.error(`Could not send the invitation to ${invitation.email}:`, err);
  }
}

// ---------------------------------------------------------------------------------------------
// For school admins and teachers: invite, list, resend, revoke.
// Admins manage every invitation of their school. Teachers can only invite students into the
// classes they teach, and only see and manage the invitations they sent themselves.
// ---------------------------------------------------------------------------------------------

const manage = express.Router();
manage.use(authenticateJWT, requireRole('school_admin', 'teacher'), requireSchool);

// The id to limit invitations to: the teacher's own, or null for an admin (all of the school's)
const sentByLimit = (req: AuthenticatedRequest) => (req.user!.role === 'teacher' ? req.user!.id : null);

// GET /api/invitations — invitations that haven't been accepted yet
manage.get('/', async (req: AuthenticatedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.email, i.role, i.created_at AS "createdAt", i.expires_at AS "expiresAt",
            i.expires_at < now() AS expired,
            CASE WHEN cl.id IS NULL THEN NULL ELSE json_build_object('id', cl.id, 'name', cl.name) END AS class,
            CASE WHEN st.id IS NULL THEN NULL
                 ELSE json_build_object('id', st.id, 'firstName', st.first_name, 'lastName', st.last_name) END AS student
     FROM invitations i
     LEFT JOIN classes cl ON cl.id = i.class_id
     LEFT JOIN users st ON st.id = i.student_id
     WHERE i.school_id = $1 AND i.accepted_at IS NULL AND ($2::uuid IS NULL OR i.invited_by = $2::uuid)
     ORDER BY i.created_at DESC`,
    [req.user!.schoolId, sentByLimit(req)]
  );
  res.json(rows);
});

// POST /api/invitations — { email, role, classId? (students), studentId? (parents), locale? }
manage.post('/', async (req: AuthenticatedRequest, res) => {
  const { role, classId = null, studentId = null, locale } = req.body ?? {};
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const schoolId = req.user!.schoolId!;

  if (!EMAIL_PATTERN.test(email) || !isInvitableRole(role)) {
    throw new HttpError(400, 'A valid email and role are required');
  }
  if ((classId !== null && (role !== 'student' || !isUuid(classId))) || (studentId !== null && (role !== 'parent' || !isUuid(studentId)))) {
    throw new HttpError(400, 'Only students can be placed in a class, and only parents linked to a child');
  }
  const teacherId = sentByLimit(req);
  if (teacherId && (role !== 'student' || classId === null)) {
    throw new HttpError(403, 'Teachers can invite students into the classes they teach', 'TEACHERS_INVITE_STUDENTS');
  }

  const existing = await pool.query<{ school_id: string | null }>('SELECT school_id FROM users WHERE lower(email) = $1', [email]);
  const memberOf = existing.rows[0]?.school_id;
  if (memberOf === schoolId) throw new HttpError(409, 'This person is already in your school', 'ALREADY_MEMBER');
  if (memberOf) throw new HttpError(409, 'This person belongs to another school', 'IN_OTHER_SCHOOL');

  const { token, hash } = newLinkToken();
  try {
    // Only inserts when the class and the child belong to the school, and, for a teacher,
    // when the class is one they teach
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO invitations (school_id, email, role, class_id, student_id, token_hash, invited_by, expires_at)
       SELECT $1, $2, $3, $4::uuid, $5::uuid, $6, $7, now() + make_interval(days => $8)
       WHERE ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM classes WHERE id = $4::uuid AND school_id = $1))
         AND ($5::uuid IS NULL OR EXISTS (
           SELECT 1 FROM users WHERE id = $5::uuid AND school_id = $1 AND role = 'student'))
         AND ($9::uuid IS NULL OR EXISTS (
           SELECT 1 FROM courses WHERE class_id = $4::uuid AND teacher_id = $9::uuid))
       RETURNING id`,
      [schoolId, email, role, classId, studentId, hash, req.user!.id, INVITATION_TTL_DAYS, teacherId]
    );
    if (rows.length === 0) {
      throw new HttpError(404, teacherId ? 'You do not teach this class' : 'Class or student not found in your school');
    }

    await sendInvitation({ email, role }, token, req.user!.id, toEmailLocale(locale));
    res.status(201).json({ id: rows[0]!.id, email, role });
  } catch (err) {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) {
      throw new HttpError(409, 'This person already has a pending invitation. Resend it instead.', 'INVITATION_PENDING');
    }
    throw err;
  }
});

// POST /api/invitations/:id/resend — a new link and a fresh expiry; the old link stops working
manage.post('/:id/resend', async (req: AuthenticatedRequest, res) => {
  const invitationId = req.params.id;
  if (!isUuid(invitationId)) throw new HttpError(404, 'Invitation not found');

  const { token, hash } = newLinkToken();
  const { rows } = await pool.query<{ email: string; role: InvitableRole }>(
    `UPDATE invitations SET token_hash = $3, expires_at = now() + make_interval(days => $4)
     WHERE id = $1 AND school_id = $2 AND accepted_at IS NULL AND ($5::uuid IS NULL OR invited_by = $5::uuid)
     RETURNING email, role`,
    [invitationId, req.user!.schoolId, hash, INVITATION_TTL_DAYS, sentByLimit(req)]
  );
  if (rows.length === 0) throw new HttpError(404, 'Invitation not found');

  await sendInvitation(rows[0]!, token, req.user!.id, toEmailLocale(req.body?.locale));
  res.status(204).end();
});

// DELETE /api/invitations/:id — revokes a pending invitation
manage.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const invitationId = req.params.id;
  const { rowCount } = isUuid(invitationId)
    ? await pool.query(
        `DELETE FROM invitations
         WHERE id = $1 AND school_id = $2 AND accepted_at IS NULL AND ($3::uuid IS NULL OR invited_by = $3::uuid)`,
        [invitationId, req.user!.schoolId, sentByLimit(req)]
      )
    : { rowCount: 0 };

  if (rowCount === 0) throw new HttpError(404, 'Invitation not found');
  res.status(204).end();
});

// ---------------------------------------------------------------------------------------------
// For the invited person: look the invitation up, then accept it. Signed out; the token is the key.
// ---------------------------------------------------------------------------------------------

// GET /api/invitations/lookup?token= — what the invitation is for, to show before accepting
router.get('/lookup', async (req: Request, res: Response) => {
  const { token } = req.query;
  if (!isNonEmptyString(token)) throw invalidInvitation();

  const { rows } = await pool.query(
    `SELECT i.email, i.role, s.name AS "schoolName",
            EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = i.email) AS "hasAccount"
     FROM invitations i JOIN schools s ON s.id = i.school_id
     WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
    [sha256(token)]
  );
  if (rows.length === 0) throw invalidInvitation();
  res.json(rows[0]);
});

// ---------------------------------------------------------------------------------------------
// Accepting: shared by the emailed link and by signed-in people accepting in the app
// ---------------------------------------------------------------------------------------------

const PENDING = 'accepted_at IS NULL AND expires_at > now()';

// Makes an existing account a member of the invitation's school, with the invited role
async function joinWithAccount(client: PoolClient, invitation: InvitationRow, account: UserRow, emailProven: boolean) {
  if (account.role === 'super_admin' || (account.school_id && account.school_id !== invitation.school_id)) {
    throw new HttpError(409, 'This account belongs to another school', 'IN_OTHER_SCHOOL');
  }
  const { rows } = await client.query<UserRow>(
    `UPDATE users SET school_id = $2, role = $3,
       email_verified_at = CASE WHEN $4::boolean THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END
     WHERE id = $1 RETURNING *`,
    [account.id, invitation.school_id, invitation.role, emailProven]
  );
  return rows[0]!;
}

// Sets up what the invitation promised and marks it used
async function completeInvitation(client: PoolClient, invitation: InvitationRow, memberId: string) {
  // ON CONFLICT DO NOTHING: being in the class or linked to the child already is fine
  if (invitation.class_id) {
    await client.query('INSERT INTO class_students (class_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      invitation.class_id,
      memberId,
    ]);
  }
  if (invitation.student_id) {
    await client.query('INSERT INTO parent_student (parent_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
      memberId,
      invitation.student_id,
    ]);
  }
  await client.query('UPDATE invitations SET accepted_at = now() WHERE id = $1', [invitation.id]);
}

// POST /api/invitations/accept — { token, password, firstName?, lastName? }
// From the emailed link. New people create their account; people who already have one confirm it
// with their password. Either way they join the school with the invited role, and come back signed in.
router.post('/accept', async (req: Request, res: Response) => {
  const { token, password, firstName, lastName } = req.body ?? {};
  if (!isNonEmptyString(token)) throw invalidInvitation();
  if (!isNonEmptyString(password)) throw new HttpError(400, 'Password is required');

  const user = await withTransaction(async (client) => {
    // FOR UPDATE: if the link is opened twice at once, the second request waits and then finds it used
    const invitation = (
      await client.query<InvitationRow>(
        `SELECT id, school_id, email, role, class_id, student_id FROM invitations
         WHERE token_hash = $1 AND ${PENDING}
         FOR UPDATE`,
        [sha256(token)]
      )
    ).rows[0];
    if (!invitation) throw invalidInvitation();

    const existing = (
      await client.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1 FOR UPDATE', [invitation.email])
    ).rows[0];

    let member: UserRow;
    if (existing) {
      if (!(await comparePassword(password, existing.password_hash))) {
        throw new HttpError(401, 'Wrong password for this account', 'WRONG_PASSWORD');
      }
      // Opening the emailed link proves the address
      member = await joinWithAccount(client, invitation, existing, true);
    } else {
      if (!isNonEmptyString(firstName) || !isNonEmptyString(lastName)) {
        throw new HttpError(400, 'First name and last name are required');
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      }
      member = (
        await client.query<UserRow>(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, email_verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           RETURNING *`,
          [invitation.email, await hashPassword(password), firstName.trim(), lastName.trim(), invitation.role, invitation.school_id]
        )
      ).rows[0]!;
    }

    await completeInvitation(client, invitation, member.id);
    return member;
  });

  res.json(toSession(user));
});

// GET /api/invitations/mine — pending invitations addressed to the signed-in user's email
router.get('/mine', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  // The email comes from the database, not the token, in case it changed since sign-in
  const { rows } = await pool.query(
    `SELECT i.id, i.role, i.expires_at AS "expiresAt", s.name AS "schoolName",
            inviter.first_name || ' ' || inviter.last_name AS "invitedBy",
            cl.name AS "className"
     FROM invitations i
     JOIN users me ON lower(me.email) = i.email
     JOIN schools s ON s.id = i.school_id
     LEFT JOIN users inviter ON inviter.id = i.invited_by
     LEFT JOIN classes cl ON cl.id = i.class_id
     WHERE me.id = $1 AND i.accepted_at IS NULL AND i.expires_at > now()
     ORDER BY i.created_at DESC`,
    [req.user!.id]
  );
  res.json(rows);
});

// POST /api/invitations/mine/:id/accept — joins the school from inside the app.
// Being signed in as the invited email is the proof, so no link or password is needed.
router.post('/mine/:id/accept', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const invitationId = req.params.id;
  if (!isUuid(invitationId)) throw invalidInvitation();

  const user = await withTransaction(async (client) => {
    const account = (await client.query<UserRow>('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user!.id])).rows[0];
    if (!account) throw new HttpError(401, 'Session expired, please sign in again');
    // With verification on, only an address the person has shown they own can collect invitations sent to it
    if (emailVerificationRequired() && !account.email_verified_at) {
      throw new HttpError(403, 'Confirm your email before accepting invitations', 'EMAIL_NOT_VERIFIED');
    }

    const invitation = (
      await client.query<InvitationRow>(
        `SELECT id, school_id, email, role, class_id, student_id FROM invitations
         WHERE id = $1 AND email = lower($2) AND ${PENDING}
         FOR UPDATE`,
        [invitationId, account.email]
      )
    ).rows[0];
    if (!invitation) throw invalidInvitation();

    const member = await joinWithAccount(client, invitation, account, false);
    await completeInvitation(client, invitation, member.id);
    return member;
  });

  // A new token: the old one still says "no school"
  res.json(toSession(user));
});

// The routes for the invited person go first, so /lookup, /accept and /mine are never read as an invitation id
router.use(manage);

export default router;
