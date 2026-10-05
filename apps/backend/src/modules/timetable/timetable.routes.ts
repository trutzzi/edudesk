import express from 'express';
import { authenticateJWT, currentUser, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readDateRange } from '../../http/query.js';
import { lessonsBetween, type LessonScope } from './lessons.repository.js';
import { MAX_LESSON_RANGE_DAYS } from './limits.js';
import { timezoneOf } from './timetable.repository.js';

const router = express.Router();
router.use(authenticateJWT);

const PERSONAL_SCOPES: LessonScope[] = ['teacher', 'student', 'parent'];
const isPersonalScope = (role: string): role is LessonScope => PERSONAL_SCOPES.includes(role as LessonScope);

// GET /api/timetable?from&to: the caller's own lessons (a teacher's, a student's, or a parent's children's)
router.get('/', async (req: AuthenticatedRequest, res) => {
  const user = currentUser(req);
  if (!isPersonalScope(user.role)) throw new HttpError(403, 'Timetables are for teachers, students and parents');
  const { from, to } = readDateRange(req.query, MAX_LESSON_RANGE_DAYS);

  const [timezone, lessons] = await Promise.all([timezoneOf(user.schoolId), lessonsBetween(from, to, user.role, user.id)]);
  res.json({ timezone, lessons });
});

export default router;
