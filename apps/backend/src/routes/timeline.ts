import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { lessonsBetween, timezoneOf } from '../queries/lessons.js';
import { daysBetween, isDateString } from '../utils/validation.js';

// Caps how much one request can ask for: a school year of courses, and six weeks of lessons,
// which is what a month view shows (whole weeks around the month)
const MAX_COURSE_RANGE_DAYS = 400;
export const MAX_LESSON_RANGE_DAYS = 42;

// Reads ?from=YYYY-MM-DD&to=YYYY-MM-DD, or sends a 400 and returns null
export function readRange(req: AuthenticatedRequest, res: express.Response, maxDays: number) {
  const { from, to } = req.query;
  if (!isDateString(from) || !isDateString(to) || daysBetween(from, to) < 0 || daysBetween(from, to) > maxDays) {
    res.status(400).json({ message: `from and to must be dates (YYYY-MM-DD) at most ${maxDays} days apart` });
    return null;
  }
  return { from, to };
}

const router = express.Router();

router.use(authenticateJWT, requireRole('school_admin'), requireSchool);

// GET /api/timeline/courses?from&to — courses running at any point in the range, for the term and month views
router.get('/courses', async (req: AuthenticatedRequest, res) => {
  const range = readRange(req, res, MAX_COURSE_RANGE_DAYS);
  if (!range) return;
  const schoolId = req.user!.schoolId!;

  const [timezone, courses] = await Promise.all([
    timezoneOf(schoolId),
    pool.query(
      // Two periods overlap when each one starts before the other ends
      `SELECT co.id, co.name,
              co.start_date::text AS "startDate", co.end_date::text AS "endDate",
              json_build_object('id', cl.id, 'name', cl.name) AS class,
              json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name) AS teacher
       FROM courses co
       JOIN classes cl ON cl.id = co.class_id
       JOIN users t ON t.id = co.teacher_id
       WHERE cl.school_id = $1 AND co.start_date <= $3::date AND co.end_date >= $2::date
       ORDER BY cl.name, co.name`,
      [schoolId, range.from, range.to]
    ),
  ]);

  res.json({ timezone, courses: courses.rows });
});

// GET /api/timeline/lessons?from&to — every lesson in the school on every day of the range
router.get('/lessons', async (req: AuthenticatedRequest, res) => {
  const range = readRange(req, res, MAX_LESSON_RANGE_DAYS);
  if (!range) return;
  const schoolId = req.user!.schoolId!;

  const [timezone, lessons] = await Promise.all([
    timezoneOf(schoolId),
    lessonsBetween(range.from, range.to, 'cl.school_id = $3', [schoolId]),
  ]);

  res.json({ timezone, lessons });
});

export default router;
