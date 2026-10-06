import { pool } from '../../db/pool.js';
import type { UserRow } from '../users/users.repository.js';

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
