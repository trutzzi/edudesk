import express from 'express';
import { authenticateJWT, currentUser, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody, readDateRange, readId } from '../../http/query.js';
import { daysBetween, isDateString, isNonEmptyString, isUuid } from '../../lib/validation.js';
import { createEvent, deleteEvent, EVENT_KINDS, listPublicHolidays, listSchoolEvents, type EventKind } from './events.repository.js';

const router = express.Router();
router.use(authenticateJWT, requireSchool);

const MAX_RANGE_DAYS = 400;
const isEventKind = (value: unknown): value is EventKind => EVENT_KINDS.includes(value as EventKind);

// GET /api/events?from&to: the school's events overlapping the range, plus its country's public holidays
// (marked national). Everyone in the school can see them.
router.get('/', async (req: AuthenticatedRequest, res) => {
  const { from, to } = readDateRange(req.query, MAX_RANGE_DAYS);
  const schoolId = schoolIdOf(req);
  const [schoolEvents, publicHolidays] = await Promise.all([listSchoolEvents(schoolId, from, to), listPublicHolidays(schoolId, from, to)]);

  // Earlier first; on the same start, longer first, so multi-day events keep the top lanes in the calendar
  const events = [...schoolEvents, ...publicHolidays].sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate) || a.title.localeCompare(b.title),
  );
  res.json(events);
});

// POST /api/events: { title, kind, startDate, endDate?, classId? }
router.post('/', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { title, kind = 'other', startDate, endDate = startDate, classId = null } = readBody(req);

  if (
    !isNonEmptyString(title) ||
    !isEventKind(kind) ||
    !isDateString(startDate) ||
    !isDateString(endDate) ||
    (classId !== null && !isUuid(classId))
  ) {
    throw new HttpError(400, 'Title, kind and dates (YYYY-MM-DD) are required');
  }
  if (daysBetween(startDate, endDate) < 0) throw new HttpError(400, 'The end date must be on or after the start date');

  const event = await createEvent({
    schoolId: schoolIdOf(req),
    classId,
    title: title.trim(),
    kind,
    startDate,
    endDate,
    createdBy: currentUser(req).id,
  });
  if (!event) throw new HttpError(404, 'Class not found in your school');
  res.status(201).json(event);
});

// DELETE /api/events/:id
router.delete('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const eventId = readId(req.params.id, 'Event not found');
  if (!(await deleteEvent(eventId, schoolIdOf(req)))) throw new HttpError(404, 'Event not found');
  res.status(204).end();
});

export default router;
