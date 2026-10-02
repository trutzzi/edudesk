import express, { type Request, type Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { pool } from '../db.js';
import { toEmailLocale, type EmailLocale } from '../emails/layout.js';
import { verificationEmail } from '../emails/verification.js';
import { hashPassword, comparePassword, toSession } from '../utils/auth.js';
import { HttpError } from '../middleware/errors.js';
import { sendMail } from '../utils/mailer.js';
import { isNonEmptyString, isPgError, PG_ERRORS } from '../utils/validation.js';
import { hashIp, sha256 } from '../utils/tokens.js';
import { withTransaction } from '../utils/transaction.js';
import { createVerificationToken, emailVerificationRequired, verificationLink } from '../utils/verification.js';

const router = express.Router();

// super_admin accounts are provisioned manually, never through signup
const SELF_SERVICE_ROLES = new Set(['school_admin', 'teacher', 'student', 'parent']);
const MIN_PASSWORD_LENGTH = 8;
const CHECK_EMAIL_MESSAGE = 'Check your email for a link to activate your account';

// Schools often share one public IP, so keep this generous and adjustable
const maxAccountsPerIp = () => Number(process.env.MAX_ACCOUNTS_PER_IP_PER_DAY) || 5;

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

// Sending can fail (SMTP down, typo in the address). The account still exists and the user can ask for a new link.
async function sendVerificationEmail(user: UserRow, token: string, locale: EmailLocale) {
  try {
    await sendMail(verificationEmail(user.email, user.first_name, verificationLink(token), locale));
  } catch (err) {
    console.error(`Could not send the verification email to ${user.email}:`, err);
  }
}

// POST /api/auth/register — creates an unverified account and emails a confirmation link
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role, schoolId = null, website, locale } = req.body ?? {};

  // Honeypot: "website" is a field people never see, so only bots fill it in.
  // Answer as if it worked, so the bot has no reason to try something else.
  if (isNonEmptyString(website)) {
    res.status(201).json({ message: CHECK_EMAIL_MESSAGE });
    return;
  }

  if (![email, password, firstName, lastName].every(isNonEmptyString)) {
    res.status(400).json({ message: 'Email, password, first name and last name are required' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }
  if (!SELF_SERVICE_ROLES.has(role)) {
    res.status(400).json({ message: 'Invalid role' });
    return;
  }

  // ipKeyGenerator groups IPv6 addresses by network, so rotating addresses in one home doesn't reset the count
  const ipHash = hashIp(ipKeyGenerator(req.ip ?? 'unknown'));
  const recent = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users
     WHERE registration_ip_hash = $1 AND created_at > now() - interval '1 day'`,
    [ipHash]
  );
  if (recent.rows[0]!.count >= maxAccountsPerIp()) {
    res.status(429).json({ message: 'Too many accounts were created from this network today', code: 'TOO_MANY_ACCOUNTS' });
    return;
  }

  const verify = emailVerificationRequired();
  const passwordHash = await hashPassword(password);

  // The user and their verification token are saved together, or not at all
  const { user, token } = await withTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, school_id, registration_ip_hash, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $8::boolean THEN NULL ELSE now() END)
       RETURNING *`,
      [email.trim().toLowerCase(), passwordHash, firstName.trim(), lastName.trim(), role, schoolId, ipHash, verify]
    );
    const created = rows[0]!;
    return { user: created, token: verify ? await createVerificationToken(client, created.id) : null };
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) throw new HttpError(409, 'An account with this email already exists');
    throw err;
  });

  if (!token) {
    res.status(201).json(toSession(user));
    return;
  }
  await sendVerificationEmail(user, token, toEmailLocale(locale));
  res.status(201).json({ message: CHECK_EMAIL_MESSAGE });
});

// POST /api/auth/verify-email — { token } from the email link; signs the user in
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body ?? {};
  if (!isNonEmptyString(token)) {
    res.status(400).json({ message: 'This link is invalid or has expired', code: 'INVALID_TOKEN' });
    return;
  }

  // Deleting the token and verifying the user happen in one statement, so a link can never be used twice.
  // An expired token is deleted too, but matches no user.
  const { rows } = await pool.query<UserRow>(
    `WITH used AS (
       DELETE FROM email_verification_tokens WHERE token_hash = $1 RETURNING user_id, expires_at
     )
     UPDATE users u SET email_verified_at = COALESCE(u.email_verified_at, now())
     FROM used
     WHERE u.id = used.user_id AND used.expires_at > now()
     RETURNING u.*`,
    [sha256(token)]
  );
  const user = rows[0];
  if (!user) {
    res.status(400).json({ message: 'This link is invalid or has expired', code: 'INVALID_TOKEN' });
    return;
  }

  res.json(toSession(user));
});

// POST /api/auth/resend-verification — { email }
router.post('/resend-verification', async (req: Request, res: Response) => {
  const { email, locale } = req.body ?? {};
  if (!isNonEmptyString(email)) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  const { rows } = await pool.query<UserRow>(
    'SELECT * FROM users WHERE lower(email) = $1 AND email_verified_at IS NULL',
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  if (user) {
    await sendVerificationEmail(user, await createVerificationToken(pool, user.id), toEmailLocale(locale));
  }

  // Same answer whether or not the account exists, so this can't be used to discover who has an account
  res.json({ message: 'If that account still needs confirming, we sent a new link' });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1', [email.trim().toLowerCase()]);
  const user = rows[0];

  if (!user || !(await comparePassword(password, user.password_hash))) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }
  // Checked after the password, so only the account owner learns it isn't verified yet
  if (emailVerificationRequired() && !user.email_verified_at) {
    res.status(403).json({ message: 'Confirm your email before signing in', code: 'EMAIL_NOT_VERIFIED' });
    return;
  }

  res.json(toSession(user));
});

export default router;
