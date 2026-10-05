import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { UserRow } from '../users/users.repository.js';

export async function countRecentSignups(ipHash: string) {
  const { rows } = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users
     WHERE registration_ip_hash = $1 AND created_at > now() - interval '1 day'`,
    [ipHash],
  );
  return rows[0]!.count;
}

interface NewUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: string;
  schoolId: string | null;
  ipHash: string;
  // Without verification the account counts as confirmed straight away
  needsVerification: boolean;
}

export async function insertUser(client: PoolClient, user: NewUser) {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, registration_ip_hash, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8::boolean THEN NULL ELSE now() END)
     RETURNING *`,
    [user.email, user.passwordHash, user.firstName, user.lastName, user.role, user.schoolId, user.ipHash, user.needsVerification],
  );
  return rows[0]!;
}

// Uses up a verification link and confirms its user, in one statement so a link can never work twice.
// An expired link is used up too, but confirms nobody (returns undefined).
export async function consumeVerificationToken(tokenHash: string) {
  const { rows } = await pool.query<UserRow>(
    `WITH used AS (
       DELETE FROM email_verification_tokens WHERE token_hash = $1 RETURNING user_id, expires_at
     )
     UPDATE users u SET email_verified_at = COALESCE(u.email_verified_at, now())
     FROM used
     WHERE u.id = used.user_id AND used.expires_at > now()
     RETURNING u.*`,
    [tokenHash],
  );
  return rows[0];
}

export async function findUnverifiedUser(email: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1 AND email_verified_at IS NULL', [
    email.trim().toLowerCase(),
  ]);
  return rows[0];
}
