import express from 'express';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../utils/transaction.js';
import { authenticateJWT, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { toSession } from '../utils/auth.js';
import { isNonEmptyString, isPgError, PG_ERRORS } from '../utils/validation.js';

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9-]{3,20}$/;

// Intl knows every real time zone name; anything it rejects isn't one
const isTimeZone = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

// POST /api/schools — { name, code, timezone? }
// A school admin without a school creates one and becomes its admin. Returns a new session,
// because the old token still says "no school".
router.post('/', authenticateJWT, requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { name, timezone = 'Europe/Bucharest' } = req.body ?? {};
  const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';

  if (!isNonEmptyString(name) || !CODE_PATTERN.test(code) || !isTimeZone(timezone)) {
    res.status(400).json({ message: 'A name, a code of 3–20 letters, digits or dashes, and a valid time zone are required' });
    return;
  }

  const user = await withTransaction(async (client) => {
    const school = await client.query<{ id: string }>(
      'INSERT INTO schools (name, code, timezone) VALUES ($1, $2, $3) RETURNING id',
      [name.trim(), code, timezone]
    );
    // Checked in the database, not the token: the token may be older than a link made since
    const { rows } = await client.query(
      'UPDATE users SET school_id = $1 WHERE id = $2 AND school_id IS NULL RETURNING *',
      [school.rows[0]!.id, req.user!.id]
    );
    if (rows.length === 0) {
      throw new HttpError(409, 'Your account already belongs to a school. Sign in again to refresh it.');
    }
    return rows[0];
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) {
      throw new HttpError(409, 'Another school already uses this code', 'SCHOOL_CODE_TAKEN');
    }
    throw err;
  });

  res.status(201).json(toSession(user));
});

export default router;
