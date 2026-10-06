import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody, readId } from '../../http/query.js';
import { isSchoolRole } from '../../lib/roles.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import { invalid, readEmail, readPassword, readPaymentType, readPhone, readSpecializations, readText, toMemberError } from './fields.js';
import {
  countTaughtCourses,
  findMember,
  insertMember,
  listMembers,
  lockMember,
  replaceSpecializations,
  unlinkFromSchool,
  updateMember,
  type MemberChanges,
} from './users.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireRole('school_admin'), requireSchool);

const NOT_FOUND = 'Person not found in your school';
// The roles an admin creates accounts for; admins and parents still join by invitation
const CREATABLE_ROLES = ['teacher', 'student'] as const;
const NOT_THE_SCHOOLS = new HttpError(404, 'A room or therapy was not found in your school');

// GET /api/users?role=teacher: people in the school; without ?role, everyone
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { role } = req.query;
  if (role !== undefined && !isSchoolRole(role)) throw new HttpError(400, 'role must be teacher, student, parent or school_admin');
  res.json(await listMembers(schoolIdOf(req), role ?? null));
});

// POST /api/users: { role: teacher|student, firstName, lastName, phone, password, email?,
//   specializations? (therapists), paymentType?, classId? (clients) }
// The admin creates the account; the person signs in with their phone or email and that password.
router.post('/', async (req: AuthenticatedRequest, res) => {
  const body = readBody(req);
  const role = CREATABLE_ROLES.find((value) => value === body.role);
  if (!role) throw invalid('role must be teacher or student');
  if (!isNonEmptyString(body.firstName) || !isNonEmptyString(body.lastName)) throw invalid('First and last name are required');
  const classId = body.classId ?? null;
  if (classId !== null && (role !== 'student' || !isUuid(classId))) throw invalid('Only clients can be placed in a room');
  const schoolId = schoolIdOf(req);

  const member = {
    role,
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    phone: readPhone(body.phone),
    email: readEmail(body.email ?? null),
    passwordHash: await readPassword(body.password),
    specializations: role === 'teacher' ? readSpecializations(body.specializations ?? []) : [],
    paymentType: role === 'student' ? readPaymentType(body.paymentType ?? null) : null,
    details: readText(body.details ?? null),
    notes: readText(body.notes ?? null),
    classId,
  };

  const created = await withTransaction(async (client) => {
    const id = await insertMember(client, schoolId, member);
    if (!id) throw NOT_THE_SCHOOLS;
    return findMember(id, schoolId, client);
  }).catch((err) => {
    throw toMemberError(err);
  });
  res.status(201).json(created);
});

// PATCH /api/users/:id: any of { firstName, lastName, phone, email, password, specializations, paymentType, details, notes }
router.patch('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = readId(req.params.id, NOT_FOUND);
  const body = readBody(req);
  const schoolId = schoolIdOf(req);

  const changes: MemberChanges = {};
  for (const key of ['firstName', 'lastName'] as const) {
    if (body[key] === undefined) continue;
    if (!isNonEmptyString(body[key])) throw invalid('Names cannot be empty');
    changes[key] = body[key].trim();
  }
  if (body.phone !== undefined) changes.phone = body.phone === null || body.phone === '' ? null : readPhone(body.phone);
  if (body.email !== undefined) changes.email = readEmail(body.email);
  if (body.password !== undefined) changes.passwordHash = await readPassword(body.password);
  if (body.details !== undefined) changes.details = readText(body.details);
  if (body.notes !== undefined) changes.notes = readText(body.notes);
  const specializations = body.specializations === undefined ? undefined : readSpecializations(body.specializations);
  const paymentType = body.paymentType === undefined ? undefined : readPaymentType(body.paymentType);

  const updated = await withTransaction(async (client) => {
    const member = await lockMember(client, userId, schoolId);
    if (!member) throw new HttpError(404, NOT_FOUND);
    if (specializations !== undefined && member.role !== 'teacher') throw invalid('Only therapists have specializations');
    if (paymentType !== undefined && member.role !== 'student') throw invalid('Only clients have a payment type');

    await updateMember(client, userId, { ...changes, paymentType });
    if (
      specializations !== undefined &&
      (await replaceSpecializations(client, userId, schoolId, specializations)) !== specializations.length
    ) {
      throw NOT_THE_SCHOOLS;
    }
    return findMember(userId, schoolId, client);
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.checkViolation)) throw invalid('Keep a phone number or an email, so they can sign in');
    throw toMemberError(err);
  });
  res.json(updated);
});

// DELETE /api/users/:id: removes someone from the school. The account stays, unlinked, so they can still
// sign in and be invited again.
router.delete('/:id', async (req: AuthenticatedRequest, res) => {
  const userId = readId(req.params.id, NOT_FOUND);
  if (userId === currentUser(req).id) throw new HttpError(400, "You can't remove yourself from the school", 'CANNOT_REMOVE_SELF');
  const schoolId = schoolIdOf(req);

  await withTransaction(async (client) => {
    if (!(await lockMember(client, userId, schoolId))) throw new HttpError(404, NOT_FOUND);

    // A course needs its teacher, so the school decides what happens to the courses first
    const courses = await countTaughtCourses(client, userId);
    if (courses > 0) {
      throw new HttpError(409, `This teacher still teaches ${courses} courses. Delete or reassign them first.`, 'TEACHER_HAS_COURSES');
    }
    await unlinkFromSchool(client, userId);
  });

  res.status(204).end();
});

export default router;
