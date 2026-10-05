import express, { type Request, type Response } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { withTransaction } from '../../db/transaction.js';
import { toEmailLocale } from '../../emails/layout.js';
import { HttpError } from '../../http/errors.js';
import { readBody } from '../../http/query.js';
import { comparePassword, hashPassword } from '../../lib/password.js';
import { isSchoolRole } from '../../lib/roles.js';
import { toSession } from '../../lib/session.js';
import { hashIp, sha256 } from '../../lib/tokens.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import { findUserByEmail } from '../users/users.repository.js';
import { consumeVerificationToken, countRecentSignups, findUnverifiedUser, insertUser } from './auth.repository.js';
import { createVerificationToken, emailVerificationRequired, sendVerificationEmail } from './verification.js';

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
const CHECK_EMAIL_MESSAGE = 'Check your email for a link to activate your account';
const INVALID_LINK = new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');

// POST /api/auth/register: creates an account; with email verification on, it waits for the emailed link
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role, schoolId: requestedSchoolId = null, website, locale } = readBody(req);

  // Honeypot: "website" is a field people never see, so only bots fill it in.
  // Answer as if it worked, so the bot has no reason to try something else.
  if (isNonEmptyString(website)) {
    res.status(201).json({ message: CHECK_EMAIL_MESSAGE });
    return;
  }

  if (!isNonEmptyString(email) || !isNonEmptyString(password) || !isNonEmptyString(firstName) || !isNonEmptyString(lastName)) {
    throw new HttpError(400, 'Email, password, first name and last name are required');
  }
  if (password.length < MIN_PASSWORD_LENGTH) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  // Super admins are created by hand, never through sign-up
  if (!isSchoolRole(role)) throw new HttpError(400, 'Invalid role');
  if (requestedSchoolId !== null && !isUuid(requestedSchoolId)) throw new HttpError(400, 'Invalid school');
  const schoolId = requestedSchoolId;

  // ipKeyGenerator groups IPv6 addresses by network, so rotating addresses in one home doesn't reset the count
  const ipHash = hashIp(ipKeyGenerator(req.ip ?? 'unknown'));
  if ((await countRecentSignups(ipHash)) >= env.maxAccountsPerIpPerDay) {
    throw new HttpError(429, 'Too many accounts were created from this network today', 'TOO_MANY_ACCOUNTS');
  }

  const needsVerification = emailVerificationRequired();
  const passwordHash = await hashPassword(password);

  // The user and their verification token are saved together, or not at all
  const { user, token } = await withTransaction(async (client) => {
    const created = await insertUser(client, {
      email: email.trim().toLowerCase(),
      passwordHash,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      schoolId,
      ipHash,
      needsVerification,
    });
    return { user: created, token: needsVerification ? await createVerificationToken(created.id, client) : null };
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

// POST /api/auth/verify-email: { token } from the emailed link; signs the user in
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = readBody(req);
  if (!isNonEmptyString(token)) throw INVALID_LINK;

  const user = await consumeVerificationToken(sha256(token));
  if (!user) throw INVALID_LINK;
  res.json(toSession(user));
});

// POST /api/auth/resend-verification: { email }
router.post('/resend-verification', async (req: Request, res: Response) => {
  const { email, locale } = readBody(req);
  if (!isNonEmptyString(email)) throw new HttpError(400, 'Email is required');

  const user = await findUnverifiedUser(email);
  if (user) await sendVerificationEmail(user, await createVerificationToken(user.id), toEmailLocale(locale));

  // The same answer whether or not the account exists, so this can't reveal who has an account
  res.json({ message: 'If that account still needs confirming, we sent a new link' });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = readBody(req);
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) throw new HttpError(400, 'Email and password are required');

  const user = await findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.password_hash))) throw new HttpError(401, 'Invalid email or password');
  // Checked after the password, so only the account's owner learns it isn't confirmed yet
  if (emailVerificationRequired() && !user.email_verified_at) {
    throw new HttpError(403, 'Confirm your email before signing in', 'EMAIL_NOT_VERIFIED');
  }

  res.json(toSession(user));
});

export default router;
