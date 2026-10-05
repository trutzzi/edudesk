import express from 'express';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readId, readBody } from '../../http/query.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../../lib/validation.js';
import {
  addStudentToClass,
  createClass,
  deleteClass,
  findClass,
  listClassCourses,
  listClasses,
  listClassStudents,
  listTaughtClasses,
  removeStudentFromClass,
} from './classes.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireSchool);

const SCHOOL_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const CLASS_NOT_FOUND = 'Class not found';

// GET /api/classes: every class in the school, with how many students it has
router.get('/', requireRole('school_admin', 'teacher'), async (req: AuthenticatedRequest, res) => {
  res.json(await listClasses(schoolIdOf(req)));
});

// POST /api/classes: { name: "9A", schoolYear: "2026-2027" }
router.post('/', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { name, schoolYear } = readBody(req);
  if (!isNonEmptyString(name) || typeof schoolYear !== 'string' || !SCHOOL_YEAR_PATTERN.test(schoolYear)) {
    throw new HttpError(400, 'Name and school year (e.g. 2026-2027) are required');
  }

  try {
    res.status(201).json(await createClass(schoolIdOf(req), name.trim(), schoolYear));
  } catch (err) {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) throw new HttpError(409, 'This class already exists for that school year');
    throw err;
  }
});

// GET /api/classes/taught: for a teacher, the classes they teach, each with its students
router.get('/taught', requireRole('teacher'), async (req: AuthenticatedRequest, res) => {
  res.json(await listTaughtClasses(schoolIdOf(req), currentUser(req).id));
});

// GET /api/classes/:id: the class with its students and courses
router.get('/:id', requireRole('school_admin', 'teacher'), async (req: AuthenticatedRequest, res) => {
  const classId = readId(req.params.id, CLASS_NOT_FOUND);
  const schoolClass = await findClass(classId, schoolIdOf(req));
  if (!schoolClass) throw new HttpError(404, CLASS_NOT_FOUND);

  const [students, courses] = await Promise.all([listClassStudents(classId), listClassCourses(classId)]);
  res.json({ ...schoolClass, students, courses });
});

// DELETE /api/classes/:id: with its courses, weekly lessons and class events; the students stay in the school
router.delete('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const classId = readId(req.params.id, CLASS_NOT_FOUND);
  if (!(await deleteClass(classId, schoolIdOf(req)))) throw new HttpError(404, CLASS_NOT_FOUND);
  res.status(204).end();
});

// POST /api/classes/:id/students: { studentId }
router.post('/:id/students', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const classId = req.params.id;
  const { studentId } = readBody(req);
  if (!isUuid(classId) || !isUuid(studentId)) throw new HttpError(400, 'A valid class and student are required');

  try {
    if (!(await addStudentToClass(classId, studentId, schoolIdOf(req)))) {
      throw new HttpError(404, 'Class or student not found in your school');
    }
  } catch (err) {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) throw new HttpError(409, 'The student is already in this class');
    throw err;
  }
  res.status(201).json({ classId, studentId });
});

// DELETE /api/classes/:id/students/:studentId
router.delete('/:id/students/:studentId', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const notInClass = 'Student not found in this class';
  const classId = readId(req.params.id, notInClass);
  const studentId = readId(req.params.studentId, notInClass);
  if (!(await removeStudentFromClass(classId, studentId, schoolIdOf(req)))) throw new HttpError(404, notInClass);
  res.status(204).end();
});

export default router;
