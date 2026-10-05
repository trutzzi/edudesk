import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, currentUser, requireRole, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { toSession } from '../../lib/session.js';
import { isNonEmptyString, isPgError, isTimeZone, PG_ERRORS } from '../../lib/validation.js';
import { readBody } from '../../http/query.js';
import { createSchool, linkUserToSchool } from './schools.repository.js';

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;
const DEFAULT_TIMEZONE = 'Europe/Bucharest';

// POST /api/schools: { name, code, timezone? }. A school admin without a school creates one and becomes its
// admin. Returns a new session, because the old token still says "no school".
router.post('/', authenticateJWT, requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { name, code: rawCode, timezone = DEFAULT_TIMEZONE } = readBody(req);
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!isNonEmptyString(name) || !CODE_PATTERN.test(code) || !isTimeZone(timezone)) {
    throw new HttpError(400, 'A name, a code of 3–20 letters, digits or dashes, and a valid time zone are required');
  }

  const user = await withTransaction(async (client) => {
    const schoolId = await createSchool(client, name.trim(), code, timezone);
    const linked = await linkUserToSchool(client, currentUser(req).id, schoolId);
    if (!linked) throw new HttpError(409, 'Your account already belongs to a school. Sign in again to refresh it.');
    return linked;
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) throw new HttpError(409, 'Another school already uses this code', 'SCHOOL_CODE_TAKEN');
    throw err;
  });

  res.status(201).json(toSession(user));
});

export default router;
