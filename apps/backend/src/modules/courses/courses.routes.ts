import express from 'express';
import { withTransaction } from '../../db/transaction.js';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody, readId } from '../../http/query.js';
import { isDateString, isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import {
  createCourse,
  deleteCourse,
  listVisibleCourses,
  listWeeklyLessons,
  lockCourse,
  replaceWeeklyLessons,
  updateCourse,
} from './courses.repository.js';
import { isWeeklyLesson, MAX_LESSONS_PER_COURSE } from './weeklyLessons.js';

const router = express.Router();
router.use(authenticateJWT);

const NOT_FOUND = 'Course not found';
const CLASH = new HttpError(409, 'This overlaps another lesson of the same teacher or class', 'LESSON_CLASH');

// The database errors a course change can cause, as responses
function toCourseError(err: unknown) {
  if (isPgError(err, PG_ERRORS.uniqueViolation)) return new HttpError(409, 'This class already has a course with that name');
  if (isPgError(err, PG_ERRORS.checkViolation)) return new HttpError(400, 'The end date must be on or after the start date');
  if (isPgError(err, PG_ERRORS.exclusionViolation)) return CLASH;
  return err;
}

// GET /api/courses: the courses the caller may see
router.get('/', async (req: AuthenticatedRequest, res) => {
  res.json(await listVisibleCourses(currentUser(req)));
});

// POST /api/courses: { name, description?, classId, teacherId, startDate?, endDate? }
router.post('/', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const { name, description = null, classId, teacherId, startDate = null, endDate = null } = readBody(req);
  if (!isNonEmptyString(name) || !isUuid(classId) || !isUuid(teacherId)) throw new HttpError(400, 'Name, class and teacher are required');
  if (description !== null && typeof description !== 'string') throw new HttpError(400, 'Description must be text');
  if ((startDate !== null && !isDateString(startDate)) || (endDate !== null && !isDateString(endDate))) {
    throw new HttpError(400, 'Dates must look like 2026-09-01');
  }

  const course = await createCourse({
    classId,
    teacherId,
    name: name.trim(),
    description: description?.trim() || null,
    schoolId: schoolIdOf(req),
    startDate,
    endDate,
  }).catch((err) => {
    throw toCourseError(err);
  });
  if (!course) throw new HttpError(404, 'Class or teacher not found in your school');
  res.status(201).json(course);
});

// PATCH /api/courses/:id: any of { name, description, teacherId, startDate, endDate }
router.patch('/:id', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = readId(req.params.id, NOT_FOUND);
  const body = readBody(req);
  const { name, teacherId, startDate, endDate } = body;
  // `description: null` clears it, so "not sent" and "sent as null" must stay different
  const hasDescription = 'description' in body;

  if (
    (name !== undefined && !isNonEmptyString(name)) ||
    (hasDescription && body.description !== null && typeof body.description !== 'string') ||
    (teacherId !== undefined && !isUuid(teacherId)) ||
    (startDate !== undefined && !isDateString(startDate)) ||
    (endDate !== undefined && !isDateString(endDate))
  ) {
    throw new HttpError(400, 'Some fields are invalid');
  }

  const course = await updateCourse(courseId, schoolIdOf(req), {
    name: name?.trim() ?? null,
    description: hasDescription ? (typeof body.description === 'string' ? body.description.trim() || null : null) : undefined,
    teacherId: teacherId ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  }).catch((err) => {
    throw toCourseError(err);
  });
  if (!course) throw new HttpError(404, 'Course or teacher not found in your school');
  res.json(course);
});

// DELETE /api/courses/:id: with its weekly lessons
router.delete('/:id', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = readId(req.params.id, NOT_FOUND);
  if (!(await deleteCourse(courseId, schoolIdOf(req)))) throw new HttpError(404, NOT_FOUND);
  res.status(204).end();
});

// GET /api/courses/:id/lessons: the weekly schedule
router.get('/:id/lessons', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  res.json(await listWeeklyLessons(readId(req.params.id, NOT_FOUND), schoolIdOf(req)));
});

// PUT /api/courses/:id/lessons: { lessons: [{ weekday: 1, startTime: "08:00", endTime: "08:50", room: "Sala 101" }] }
// Replaces the whole weekly schedule: all of it is saved, or none of it.
router.put('/:id/lessons', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = readId(req.params.id, NOT_FOUND);
  const lessons: unknown = readBody(req).lessons;
  if (!Array.isArray(lessons) || lessons.length > MAX_LESSONS_PER_COURSE || !lessons.every(isWeeklyLesson)) {
    throw new HttpError(400, 'Each lesson needs a weekday (1–7) and a start time before its end time');
  }
  const schoolId = schoolIdOf(req);

  const saved = await withTransaction(async (client) => {
    if (!(await lockCourse(client, courseId, schoolId))) throw new HttpError(404, NOT_FOUND);
    return replaceWeeklyLessons(client, courseId, lessons);
  }).catch((err) => {
    throw toCourseError(err);
  });
  res.json(saved);
});

export default router;
