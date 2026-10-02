import type { Pool, PoolClient } from 'pg';
import { appLink, newLinkToken } from './tokens.js';

const TOKEN_TTL_HOURS = 24;

// Off by default for now: accounts can sign in and accept invitations without confirming their email.
// REQUIRE_EMAIL_VERIFICATION=true turns on the confirmation email and the checks that depend on it.
export const emailVerificationRequired = () => process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// Creates a fresh verification token for the user, replacing any older one, and returns it
export async function createVerificationToken(db: Pool | PoolClient, userId: string) {
  const { token, hash } = newLinkToken();
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await db.query(
    `INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hash, userId, TOKEN_TTL_HOURS]
  );
  return token;
}

export const verificationLink = (token: string) => appLink('/verify-email', token);
