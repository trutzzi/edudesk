import type { Pool, PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { pool } from '../../db/pool.js';
import type { EmailLocale } from '../../emails/layout.js';
import { sendMail } from '../../emails/mailer.js';
import { verificationEmail } from '../../emails/verification.js';
import { appLink, newLinkToken } from '../../lib/tokens.js';
import type { UserRow } from '../users/users.repository.js';

const TOKEN_TTL_HOURS = 24;

// Off by default for now: accounts can sign in and accept invitations without confirming their email.
// REQUIRE_EMAIL_VERIFICATION=true turns on the confirmation email and the checks that depend on it.
export const emailVerificationRequired = () => env.requireEmailVerification;

// Creates a fresh verification token for the user, replacing any older one, and returns it.
// Pass the transaction's client when the user is being created in one.
export async function createVerificationToken(userId: string, db: Pool | PoolClient = pool) {
  const { token, hash } = newLinkToken();
  await db.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  await db.query(
    `INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [hash, userId, TOKEN_TTL_HOURS],
  );
  return token;
}

// Sending can fail (SMTP down, a mistyped address). The account still exists and its owner can ask for a new link.
export async function sendVerificationEmail(user: UserRow, token: string, locale: EmailLocale) {
  try {
    await sendMail(verificationEmail(user.email, user.first_name, appLink('/verify-email', token), locale));
  } catch (err) {
    console.error(`Could not send the verification email to ${user.email}:`, err);
  }
}
