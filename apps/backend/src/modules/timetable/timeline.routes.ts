import express from 'express';
import { authenticateJWT, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { readDateRange } from '../../http/query.js';
import { lessonsBetween } from './lessons.repository.js';
import { MAX_COURSE_RANGE_DAYS, MAX_LESSON_RANGE_DAYS } from './limits.js';
import { listCoursesBetween, timezoneOf } from './timetable.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireRole('school_admin'), requireSchool);

// GET /api/timeline/courses?from&to: the school's courses running in the range (term and month views)
router.get('/courses', async (req: AuthenticatedRequest, res) => {
  const { from, to } = readDateRange(req.query, MAX_COURSE_RANGE_DAYS);
  const schoolId = schoolIdOf(req);
  const [timezone, courses] = await Promise.all([timezoneOf(schoolId), listCoursesBetween(schoolId, from, to)]);
  res.json({ timezone, courses });
});

// GET /api/timeline/lessons?from&to: every lesson in the school on every day of the range
router.get('/lessons', async (req: AuthenticatedRequest, res) => {
  const { from, to } = readDateRange(req.query, MAX_LESSON_RANGE_DAYS);
  const schoolId = schoolIdOf(req);
  const [timezone, lessons] = await Promise.all([timezoneOf(schoolId), lessonsBetween(from, to, 'school', schoolId)]);
  res.json({ timezone, lessons });
});

export default router;
