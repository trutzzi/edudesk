import express from 'express';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody } from '../../http/query.js';
import { isDateString, isTimeString, isUuid } from '../../lib/validation.js';
import { insertMark, isAttendanceStatus, schoolToday, sessionsBetween } from './sessions.repository.js';
import { buildRosters } from './sessions.js';

const router = express.Router();
router.use(authenticateJWT, requireRole('school_admin', 'teacher'), requireSchool);

// GET /api/attendance?date=2026-10-05: the day's sessions with each client's status and the therapy they have
// before and after. A therapist sees the sessions they hold; an admin sees the whole institution's.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { date } = req.query;
  if (!isDateString(date)) throw new HttpError(400, 'date must look like 2026-10-05');
  const user = currentUser(req);
  const schoolId = schoolIdOf(req);

  const [today, everything] = await Promise.all([schoolToday(schoolId), sessionsBetween(date, date, 'school', schoolId)]);
  const shown = user.role === 'teacher' ? everything.filter((row) => row.teacher.id === user.id) : everything;
  res.json({ date, today, editable: date <= today, sessions: buildRosters(shown, everything) });
});

// POST /api/attendance: { courseId, date, startTime, studentId, status }. Adds a mark; the newest one counts.
router.post('/', async (req: AuthenticatedRequest, res) => {
  const { courseId, date, startTime, studentId, status } = readBody(req);
  if (!isUuid(courseId) || !isDateString(date) || !isTimeString(startTime) || !isUuid(studentId) || !isAttendanceStatus(status)) {
    throw new HttpError(400, 'A session, client and status are required');
  }
  const user = currentUser(req);
  const schoolId = schoolIdOf(req);

  if (date > (await schoolToday(schoolId)))
    throw new HttpError(400, "A session that hasn't happened yet can't be marked", 'FUTURE_SESSION');

  // The client must really have this session that day, in this school, held by the caller unless they're an admin
  const session = (await sessionsBetween(date, date, 'client', studentId)).find(
    (row) => row.courseId === courseId && row.startTime === startTime && row.schoolId === schoolId,
  );
  if (!session) throw new HttpError(404, 'This client has no such session');
  if (user.role === 'teacher' && session.teacher.id !== user.id) throw new HttpError(403, 'Only the session’s therapist can mark it');

  await insertMark({ courseId, studentId, date, startTime, status, markedBy: user.id });
  res.status(201).json({ courseId, studentId, date, startTime, status });
});

export default router;
