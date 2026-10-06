import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody, readId } from '../../http/query.js';
import { isNonEmptyString, isPgError, PG_ERRORS } from '../../lib/validation.js';
import { countCoursesNamed, deleteTherapy, insertTherapy, listTherapies, lockTherapy, renameTherapy } from './therapies.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireSchool);

const NOT_FOUND = 'Therapy not found';
const MAX_NAME_LENGTH = 100;
const TAKEN = new HttpError(409, 'The institution already has a therapy with this name', 'THERAPY_EXISTS');

function readName(value: unknown) {
  if (!isNonEmptyString(value) || value.trim().length > MAX_NAME_LENGTH)
    throw new HttpError(400, `A name of up to ${MAX_NAME_LENGTH} characters is required`);
  return value.trim();
}

const toTherapyError = (err: unknown) => (isPgError(err, PG_ERRORS.uniqueViolation) ? TAKEN : err);

// GET /api/therapies: the institution's therapies, for admins and therapists
router.get('/', requireRole('school_admin', 'teacher'), async (req: AuthenticatedRequest, res) => {
  res.json(await listTherapies(schoolIdOf(req)));
});

// POST /api/therapies: { name }
router.post('/', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const name = readName(readBody(req).name);
  const therapy = await insertTherapy(schoolIdOf(req), name).catch((err) => {
    throw toTherapyError(err);
  });
  res.status(201).json(therapy);
});

// PATCH /api/therapies/:id: { name }. The institution's courses of this therapy are renamed too.
router.patch('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const therapyId = readId(req.params.id, NOT_FOUND);
  const name = readName(readBody(req).name);
  const schoolId = schoolIdOf(req);

  await withTransaction(async (client) => {
    const therapy = await lockTherapy(client, therapyId, schoolId);
    if (!therapy) throw new HttpError(404, NOT_FOUND);
    await renameTherapy(client, therapyId, schoolId, therapy.name, name);
  }).catch((err) => {
    throw toTherapyError(err);
  });
  res.json({ id: therapyId, name });
});

// DELETE /api/therapies/:id: only while no course runs it; therapists lose it as a specialization
router.delete('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const therapyId = readId(req.params.id, NOT_FOUND);
  const schoolId = schoolIdOf(req);

  await withTransaction(async (client) => {
    const therapy = await lockTherapy(client, therapyId, schoolId);
    if (!therapy) throw new HttpError(404, NOT_FOUND);
    const courses = await countCoursesNamed(client, schoolId, therapy.name);
    if (courses > 0) throw new HttpError(409, `${courses} courses still run this therapy. Delete them first.`, 'THERAPY_IN_USE');
    await deleteTherapy(client, therapyId);
  });
  res.status(204).end();
});

export default router;
