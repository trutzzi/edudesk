import express from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware/auth.js';
import { lessonsBetween, timezoneOf } from '../queries/lessons.js';
import { MAX_LESSON_RANGE_DAYS, readRange } from './timeline.js';

const router = express.Router();

router.use(authenticateJWT);

// Whose lessons each role sees on "my timetable". $3 is the caller's user id.
const MY_LESSONS: Record<string, string> = {
  teacher: 'co.teacher_id = $3',
  student: 'cl.id IN (SELECT class_id FROM class_students WHERE student_id = $3)',
  parent: `cl.id IN (
    SELECT cs.class_id FROM class_students cs
    JOIN parent_student ps ON ps.student_id = cs.student_id
    WHERE ps.parent_id = $3)`,
};

// GET /api/timetable?from&to — the caller's own lessons (a teacher's, a student's, or a parent's children's)
router.get('/', async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const where = MY_LESSONS[user.role];
  if (!where) {
    res.status(403).json({ message: 'Timetables are for teachers, students and parents' });
    return;
  }
  const range = readRange(req, res, MAX_LESSON_RANGE_DAYS);
  if (!range) return;

  const [timezone, lessons] = await Promise.all([
    timezoneOf(user.schoolId),
    lessonsBetween(range.from, range.to, where, [user.id]),
  ]);

  res.json({ timezone, lessons });
});

export default router;
