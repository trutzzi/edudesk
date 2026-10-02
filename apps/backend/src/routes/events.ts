import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { daysBetween, isDateString, isNonEmptyString, isUuid } from '../utils/validation.js';

const router = express.Router();

router.use(authenticateJWT, requireSchool);

const KINDS = new Set(['holiday', 'exam', 'trip', 'meeting', 'other']);
const MAX_RANGE_DAYS = 400;

const EVENT_COLUMNS = `e.id, e.title, e.kind, e.start_date::text AS "startDate", e.end_date::text AS "endDate",
  CASE WHEN cl.id IS NULL THEN NULL ELSE json_build_object('id', cl.id, 'name', cl.name) END AS class`;

// GET /api/events?from&to — the school's events overlapping the range, plus the national public holidays of
// the school's country (marked national: true; they're edited in data/holidays, not here).
// Everyone in the school can see them.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { from, to } = req.query;
  if (!isDateString(from) || !isDateString(to) || daysBetween(from, to) < 0 || daysBetween(from, to) > MAX_RANGE_DAYS) {
    res.status(400).json({ message: `from and to must be dates (YYYY-MM-DD) at most ${MAX_RANGE_DAYS} days apart` });
    return;
  }

  const [schoolEvents, publicHolidays] = await Promise.all([
    pool.query(
      `SELECT ${EVENT_COLUMNS}, false AS national
       FROM school_events e
       LEFT JOIN classes cl ON cl.id = e.class_id
       WHERE e.school_id = $1 AND e.start_date <= $3::date AND e.end_date >= $2::date`,
      [req.user!.schoolId, from, to]
    ),
    pool.query(
      `SELECT 'holiday-' || ph.country || '-' || ph.date AS id, ph.local_name AS title, ph.name AS "englishTitle",
              'holiday' AS kind, ph.date::text AS "startDate", ph.date::text AS "endDate", NULL AS class, true AS national
       FROM public_holidays ph JOIN schools s ON s.country = ph.country
       WHERE s.id = $1 AND ph.date BETWEEN $2::date AND $3::date`,
      [req.user!.schoolId, from, to]
    ),
  ]);

  // Earlier first; on the same start, longer first, so multi-day events keep the top lanes in the calendar
  const events = [...schoolEvents.rows, ...publicHolidays.rows].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.title.localeCompare(b.title)
  );
  res.json(events);
});

// POST /api/events — { title, kind, startDate, endDate, classId? }
router.post('/', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { title, kind = 'other', startDate, endDate = startDate, classId = null } = req.body ?? {};

  if (
    !isNonEmptyString(title) ||
    !KINDS.has(kind) ||
    !isDateString(startDate) ||
    !isDateString(endDate) ||
    (classId !== null && !isUuid(classId))
  ) {
    res.status(400).json({ message: 'Title, kind and dates (YYYY-MM-DD) are required' });
    return;
  }
  if (daysBetween(startDate, endDate) < 0) {
    res.status(400).json({ message: 'The end date must be on or after the start date' });
    return;
  }

  // Inserts nothing when classId points to another school's class
  const { rows } = await pool.query(
    `WITH e AS (
       INSERT INTO school_events (school_id, class_id, title, kind, start_date, end_date, created_by)
       SELECT $1, $2::uuid, $3, $4, $5, $6, $7
       WHERE $2::uuid IS NULL OR EXISTS (SELECT 1 FROM classes WHERE id = $2::uuid AND school_id = $1)
       RETURNING *
     )
     SELECT ${EVENT_COLUMNS} FROM e LEFT JOIN classes cl ON cl.id = e.class_id`,
    [req.user!.schoolId, classId, title.trim(), kind, startDate, endDate, req.user!.id]
  );
  if (rows.length === 0) {
    res.status(404).json({ message: 'Class not found in your school' });
    return;
  }
  res.status(201).json(rows[0]);
});

// DELETE /api/events/:id
router.delete('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const eventId = req.params.id;
  const { rowCount } = isUuid(eventId)
    ? await pool.query('DELETE FROM school_events WHERE id = $1 AND school_id = $2', [eventId, req.user!.schoolId])
    : { rowCount: 0 };

  if (rowCount === 0) {
    res.status(404).json({ message: 'Event not found' });
    return;
  }
  res.status(204).end();
});

export default router;
