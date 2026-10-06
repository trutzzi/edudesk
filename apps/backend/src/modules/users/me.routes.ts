import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, currentUser, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody } from '../../http/query.js';
import { comparePassword } from '../../lib/password.js';
import { isNonEmptyString, isPgError, PG_ERRORS } from '../../lib/validation.js';
import { invalid, readEmail, readLocale, readPassword, readPhone, readSpecializations, readText, toMemberError } from './fields.js';
import { findPasswordHash, findProfile, replaceSpecializations, updateMember, type MemberChanges } from './users.repository.js';

// A person's own profile: their details, language and, for therapists, the therapies they can run
const router = express.Router();
router.use(authenticateJWT);

// How a client is paid for is for staff only, so it is left out of a client's own profile too
const forSelf = <T extends { role: string; paymentType: unknown }>(profile: T) =>
  profile.role === 'student' ? { ...profile, paymentType: null } : profile;

async function profileOf(req: AuthenticatedRequest) {
  const profile = await findProfile(currentUser(req).id);
  if (!profile) throw new HttpError(401, 'Session expired, please sign in again');
  return forSelf(profile);
}

// GET /api/me
router.get('/', async (req: AuthenticatedRequest, res) => {
  res.json(await profileOf(req));
});

// PATCH /api/me: any of { firstName, lastName, phone, email, locale, details, notes, specializations (therapists) }
router.patch('/', async (req: AuthenticatedRequest, res) => {
  const body = readBody(req);
  const user = currentUser(req);

  const changes: MemberChanges = {};
  for (const key of ['firstName', 'lastName'] as const) {
    if (body[key] === undefined) continue;
    if (!isNonEmptyString(body[key])) throw invalid('Names cannot be empty');
    changes[key] = body[key].trim();
  }
  if (body.phone !== undefined) changes.phone = body.phone === null || body.phone === '' ? null : readPhone(body.phone);
  if (body.email !== undefined) changes.email = readEmail(body.email);
  if (body.locale !== undefined) changes.locale = readLocale(body.locale);
  if (body.details !== undefined) changes.details = readText(body.details);
  if (body.notes !== undefined) changes.notes = readText(body.notes);
  const specializations = body.specializations === undefined ? undefined : readSpecializations(body.specializations);
  if (specializations !== undefined && (user.role !== 'teacher' || !user.schoolId)) {
    throw invalid('Only therapists have specializations');
  }

  const profile = await withTransaction(async (client) => {
    await updateMember(client, user.id, changes);
    if (
      specializations !== undefined &&
      (await replaceSpecializations(client, user.id, user.schoolId!, specializations)) !== specializations.length
    ) {
      throw new HttpError(404, 'A therapy was not found in your institution');
    }
    return findProfile(user.id, client);
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.checkViolation)) throw invalid('Keep a phone number or an email, so you can sign in');
    throw toMemberError(err);
  });
  res.json(profile && forSelf(profile));
});

// PUT /api/me/password: { currentPassword, newPassword }
router.put('/password', async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = readBody(req);
  const userId = currentUser(req).id;
  const hash = await findPasswordHash(userId);
  if (!hash || typeof currentPassword !== 'string' || !(await comparePassword(currentPassword, hash))) {
    throw new HttpError(400, 'The current password is not right', 'WRONG_PASSWORD');
  }
  const passwordHash = await readPassword(newPassword);
  await withTransaction((client) => updateMember(client, userId, { passwordHash }));
  res.status(204).end();
});

export default router;
