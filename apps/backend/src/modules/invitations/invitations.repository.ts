import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { SchoolRole } from '../../lib/roles.js';
import type { UserRow } from '../users/users.repository.js';

const INVITATION_TTL_DAYS = 7;
const PENDING = 'accepted_at IS NULL AND expires_at > now()';

export interface InvitationRow {
  id: string;
  school_id: string;
  email: string;
  role: SchoolRole;
  class_id: string | null;
  student_id: string | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: SchoolRole;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
  class: { id: string; name: string } | null;
  student: { id: string; firstName: string; lastName: string } | null;
}

export interface InvitationLookup {
  email: string;
  role: SchoolRole;
  schoolName: string;
  hasAccount: boolean;
}

export interface InvitationForUser {
  id: string;
  role: SchoolRole;
  expiresAt: Date;
  schoolName: string;
  invitedBy: string | null;
  className: string | null;
}

// --- Managing invitations (admins, and teachers for their own) -------------------------------

// Pending invitations of the school; sentBy limits them to one person's (a teacher's own)
export async function listPending(schoolId: string, sentBy: string | null) {
  const { rows } = await pool.query<PendingInvitation>(
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
    [schoolId, sentBy],
  );
  return rows;
}

// The school an email's account belongs to: undefined without an account, null without a school
export async function findSchoolOfEmail(email: string) {
  const { rows } = await pool.query<{ school_id: string | null }>('SELECT school_id FROM users WHERE lower(email) = $1', [email]);
  return rows[0]?.school_id;
}

interface NewInvitation {
  schoolId: string;
  email: string;
  role: SchoolRole;
  classId: string | null;
  studentId: string | null;
  tokenHash: string;
  invitedBy: string;
  // Set for a teacher: the class must be one they teach
  teacherId: string | null;
}

// Inserts only when the class and the child belong to the school (and the class is the teacher's own);
// returns the new id, or undefined when nothing was inserted
export async function insertInvitation(invitation: NewInvitation) {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO invitations (school_id, email, role, class_id, student_id, token_hash, invited_by, expires_at)
     SELECT $1, $2, $3, $4::uuid, $5::uuid, $6, $7, now() + make_interval(days => $8)
     WHERE ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM classes WHERE id = $4::uuid AND school_id = $1))
       AND ($5::uuid IS NULL OR EXISTS (
         SELECT 1 FROM users WHERE id = $5::uuid AND school_id = $1 AND role = 'student'))
       AND ($9::uuid IS NULL OR EXISTS (
         SELECT 1 FROM courses WHERE class_id = $4::uuid AND teacher_id = $9::uuid))
     RETURNING id`,
    [
      invitation.schoolId,
      invitation.email,
      invitation.role,
      invitation.classId,
      invitation.studentId,
      invitation.tokenHash,
      invitation.invitedBy,
      INVITATION_TTL_DAYS,
      invitation.teacherId,
    ],
  );
  return rows[0]?.id;
}

// A new token and a fresh expiry; the old link stops working
export async function renewInvitation(invitationId: string, schoolId: string, tokenHash: string, sentBy: string | null) {
  const { rows } = await pool.query<{ email: string; role: SchoolRole }>(
    `UPDATE invitations SET token_hash = $3, expires_at = now() + make_interval(days => $4)
     WHERE id = $1 AND school_id = $2 AND accepted_at IS NULL AND ($5::uuid IS NULL OR invited_by = $5::uuid)
     RETURNING email, role`,
    [invitationId, schoolId, tokenHash, INVITATION_TTL_DAYS, sentBy],
  );
  return rows[0];
}

export async function deleteInvitation(invitationId: string, schoolId: string, sentBy: string | null) {
  const { rowCount } = await pool.query(
    `DELETE FROM invitations
     WHERE id = $1 AND school_id = $2 AND accepted_at IS NULL AND ($3::uuid IS NULL OR invited_by = $3::uuid)`,
    [invitationId, schoolId, sentBy],
  );
  return rowCount !== 0;
}

// Who is inviting, and to which school, for the email
export async function findInviter(userId: string) {
  const { rows } = await pool.query<{ inviter: string; school: string; appName: string | null }>(
    `SELECT u.first_name || ' ' || u.last_name AS inviter, s.name AS school, s.app_name AS "appName"
     FROM users u JOIN schools s ON s.id = u.school_id
     WHERE u.id = $1`,
    [userId],
  );
  return rows[0]!;
}

// --- For the invited person --------------------------------------------------------------------

export async function lookupByToken(tokenHash: string) {
  const { rows } = await pool.query<InvitationLookup>(
    `SELECT i.email, i.role, s.name AS "schoolName",
            EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = i.email) AS "hasAccount"
     FROM invitations i JOIN schools s ON s.id = i.school_id
     WHERE i.token_hash = $1 AND i.accepted_at IS NULL AND i.expires_at > now()`,
    [tokenHash],
  );
  return rows[0];
}

// Pending invitations addressed to a user's email (read from the database, in case it changed since sign-in)
export async function listForUser(userId: string) {
  const { rows } = await pool.query<InvitationForUser>(
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
    [userId],
  );
  return rows;
}

// --- Accepting, inside a transaction --------------------------------------------------------------
// FOR UPDATE: if the same invitation is accepted twice at once, the second waits and then finds it used

export async function lockPendingByToken(client: PoolClient, tokenHash: string) {
  const { rows } = await client.query<InvitationRow>(
    `SELECT id, school_id, email, role, class_id, student_id FROM invitations
     WHERE token_hash = $1 AND ${PENDING}
     FOR UPDATE`,
    [tokenHash],
  );
  return rows[0];
}

export async function lockPendingForEmail(client: PoolClient, invitationId: string, email: string) {
  const { rows } = await client.query<InvitationRow>(
    `SELECT id, school_id, email, role, class_id, student_id FROM invitations
     WHERE id = $1 AND email = lower($2) AND ${PENDING}
     FOR UPDATE`,
    [invitationId, email],
  );
  return rows[0];
}

export async function lockUserByEmail(client: PoolClient, email: string) {
  const { rows } = await client.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1 FOR UPDATE', [email]);
  return rows[0];
}

export async function lockUserById(client: PoolClient, userId: string) {
  const { rows } = await client.query<UserRow>('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
  return rows[0];
}

// Moves an account into the school with the invited role; emailProven also marks the address as confirmed
export async function joinSchool(client: PoolClient, userId: string, invitation: InvitationRow, emailProven: boolean) {
  const { rows } = await client.query<UserRow>(
    `UPDATE users SET school_id = $2, role = $3,
       email_verified_at = CASE WHEN $4::boolean THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END
     WHERE id = $1 RETURNING *`,
    [userId, invitation.school_id, invitation.role, emailProven],
  );
  return rows[0]!;
}

// A new account for the invited email, confirmed because the email link was opened
export async function insertInvitedUser(
  client: PoolClient,
  invitation: InvitationRow,
  user: { passwordHash: string; firstName: string; lastName: string },
) {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING *`,
    [invitation.email, user.passwordHash, user.firstName, user.lastName, invitation.role, invitation.school_id],
  );
  return rows[0]!;
}

// Sets up what the invitation promised and marks it used. ON CONFLICT DO NOTHING: already being in
// the class, or linked to the child, is fine.
export async function completeInvitation(client: PoolClient, invitation: InvitationRow, memberId: string) {
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
