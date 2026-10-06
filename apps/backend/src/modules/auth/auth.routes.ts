import express, { type Request, type Response } from 'express';
import { toEmailLocale } from '../../emails/layout.js';
import { HttpError } from '../../http/errors.js';
import { comparePassword } from '../../lib/password.js';
import { toSession } from '../../lib/session.js';
import { sha256 } from '../../lib/tokens.js';
import { isNonEmptyString } from '../../lib/validation.js';
import { readBody } from '../../http/query.js';
import { normalizePhone } from '../../lib/phone.js';
import { findUserByEmail, findUserByPhone } from '../users/users.repository.js';
import { consumeVerificationToken, findUnverifiedUser } from './auth.repository.js';
import { createVerificationToken, emailVerificationRequired, sendVerificationEmail } from './verification.js';

const router = express.Router();

const INVALID_LINK = new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');

// There is no public sign-up: the first admin comes from `npm run create-admin`, and admins create everyone else

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

// POST /api/auth/login: { email, password }, where "email" may also be the phone number the admin saved
router.post('/login', async (req: Request, res: Response) => {
  const { email: login, password } = readBody(req);
  if (!isNonEmptyString(login) || !isNonEmptyString(password)) throw new HttpError(400, 'Email or phone and password are required');

  const phone = login.includes('@') ? null : normalizePhone(login);
  const user = phone ? await findUserByPhone(phone) : await findUserByEmail(login);
  if (!user || !(await comparePassword(password, user.password_hash))) throw new HttpError(401, 'Invalid email or password');
  // Checked after the password, so only the account's owner learns it isn't confirmed yet
  if (emailVerificationRequired() && !user.email_verified_at) {
    throw new HttpError(403, 'Confirm your email before signing in', 'EMAIL_NOT_VERIFIED');
  }

  res.json(toSession(user));
});

export default router;
