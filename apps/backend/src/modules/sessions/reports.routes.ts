import express from 'express';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { isMonth, monthlyTotals, monthRange } from './sessions.js';
import { schoolToday, sessionsBetween } from './sessions.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireRole('school_admin', 'teacher'), requireSchool);

// GET /api/reports?month=2026-10: per client, their sessions, hours and attendance; per therapist, the hours they
// held. Only sessions up to today count. An admin sees everyone; a therapist sees the clients they have in therapy
// (all of their sessions) and their own hours.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { month } = req.query;
  if (!isMonth(month)) throw new HttpError(400, 'month must look like 2026-10');
  const user = currentUser(req);
  const schoolId = schoolIdOf(req);

  const { from, to } = monthRange(month);
  const today = await schoolToday(schoolId);
  const until = to < today ? to : today;
  const rows =
    from > until
      ? []
      : user.role === 'teacher'
        ? await sessionsBetween(from, until, 'teacherClients', user.id)
        : await sessionsBetween(from, until, 'school', schoolId);

  const totals = monthlyTotals(rows);
  res.json({
    month,
    clients: totals.clients,
    therapists: user.role === 'teacher' ? totals.therapists.filter((row) => row.teacher.id === user.id) : totals.therapists,
  });
});

export default router;
