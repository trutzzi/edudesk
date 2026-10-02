import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { withTransaction } from '../utils/transaction.js';
import { isDateString, isNonEmptyString, isPgError, isTimeString, isUuid, PG_ERRORS } from '../utils/validation.js';

const router = express.Router();

router.use(authenticateJWT);

const MAX_LESSONS_PER_COURSE = 50;
const CLASH_MESSAGE = 'This overlaps another lesson of the same teacher or class';

// Which courses each role may see. $1 is the caller's school id for admins and their user id for everyone else.
// These are fixed strings picked by role, never built from user input, so they are safe to put in the SQL.
const VISIBLE_COURSES: Record<string, { where: string; param: 'schoolId' | 'userId' | null }> = {
  super_admin: { where: 'TRUE', param: null },
  school_admin: { where: 'cl.school_id = $1', param: 'schoolId' },
  teacher: { where: 'co.teacher_id = $1', param: 'userId' },
  student: {
    where: 'co.class_id IN (SELECT class_id FROM class_students WHERE student_id = $1)',
    param: 'userId',
  },
  parent: {
    where: `co.class_id IN (
      SELECT cs.class_id FROM class_students cs
      JOIN parent_student ps ON ps.student_id = cs.student_id
      WHERE ps.parent_id = $1)`,
    param: 'userId',
  },
};

// `::text` keeps dates as "2026-09-01". Without it, pg turns them into JS Dates at local midnight,
// which JSON then shifts to the previous day in UTC.
const COURSE_COLUMNS = `co.id, co.name, co.description,
  co.start_date::text AS "startDate", co.end_date::text AS "endDate",
  co.class_id AS "classId", co.teacher_id AS "teacherId"`;

// GET /api/courses — the courses the caller is allowed to see
router.get('/', async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const scope = VISIBLE_COURSES[user.role];
  if (!scope) {
    res.status(403).json({ message: 'You do not have permission to do this' });
    return;
  }

  const params = scope.param === 'schoolId' ? [user.schoolId] : scope.param === 'userId' ? [user.id] : [];
  const { rows } = await pool.query(
    `SELECT co.id, co.name, co.description,
            co.start_date::text AS "startDate", co.end_date::text AS "endDate",
            json_build_object('id', cl.id, 'name', cl.name, 'schoolYear', cl.school_year) AS class,
            json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name) AS teacher
     FROM courses co
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     WHERE ${scope.where}
     ORDER BY cl.name, co.name`,
    params
  );
  res.json(rows);
});

// Turns the database errors a course change can cause into a response; returns false for anything else
function handleCourseError(err: unknown, res: express.Response) {
  if (isPgError(err, PG_ERRORS.uniqueViolation)) {
    res.status(409).json({ message: 'This class already has a course with that name' });
  } else if (isPgError(err, PG_ERRORS.checkViolation)) {
    res.status(400).json({ message: 'The end date must be on or after the start date' });
  } else if (isPgError(err, PG_ERRORS.exclusionViolation)) {
    res.status(409).json({ message: CLASH_MESSAGE, code: 'LESSON_CLASH' });
  } else {
    return false;
  }
  return true;
}

// POST /api/courses — { name, description?, classId, teacherId, startDate?, endDate? }
// Without dates, the course runs for its class's whole school year (1 Sep → 30 Jun).
router.post('/', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const { name, description = null, classId, teacherId, startDate = null, endDate = null } = req.body ?? {};

  if (!isNonEmptyString(name) || !isUuid(classId) || !isUuid(teacherId)) {
    res.status(400).json({ message: 'Name, class and teacher are required' });
    return;
  }
  if (description !== null && typeof description !== 'string') {
    res.status(400).json({ message: 'Description must be text' });
    return;
  }
  if ((startDate !== null && !isDateString(startDate)) || (endDate !== null && !isDateString(endDate))) {
    res.status(400).json({ message: 'Dates must look like 2026-09-01' });
    return;
  }

  try {
    // Only inserts when the class is in the caller's school and the teacher is a teacher in the same school
    const { rows } = await pool.query(
      `INSERT INTO courses AS co (class_id, teacher_id, name, description, start_date, end_date)
       SELECT cl.id, t.id, $3, $4,
              COALESCE($6::date, make_date(split_part(cl.school_year, '-', 1)::int, 9, 1)),
              COALESCE($7::date, make_date(split_part(cl.school_year, '-', 2)::int, 6, 30))
       FROM classes cl, users t
       WHERE cl.id = $1 AND cl.school_id = $5
         AND t.id = $2 AND t.school_id = $5 AND t.role = 'teacher'
       RETURNING ${COURSE_COLUMNS}`,
      [classId, teacherId, name.trim(), description?.trim() || null, req.user!.schoolId, startDate, endDate]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: 'Class or teacher not found in your school' });
      return;
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    if (!handleCourseError(err, res)) throw err;
  }
});

// PATCH /api/courses/:id — any of { name, description, teacherId, startDate, endDate }
router.patch('/:id', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = req.params.id;
  const body = req.body ?? {};
  const { name, teacherId, startDate, endDate } = body;
  // `description: null` clears it, so "not sent" and "sent as null" must stay different
  const hasDescription = 'description' in body;

  if (!isUuid(courseId)) {
    res.status(404).json({ message: 'Course not found' });
    return;
  }
  if (
    (name !== undefined && !isNonEmptyString(name)) ||
    (hasDescription && body.description !== null && typeof body.description !== 'string') ||
    (teacherId !== undefined && !isUuid(teacherId)) ||
    (startDate !== undefined && !isDateString(startDate)) ||
    (endDate !== undefined && !isDateString(endDate))
  ) {
    res.status(400).json({ message: 'Some fields are invalid' });
    return;
  }

  try {
    // COALESCE($n, column) keeps the current value for every field that wasn't sent
    const { rows } = await pool.query(
      `UPDATE courses co SET
         name        = COALESCE($2, co.name),
         description = CASE WHEN $3::boolean THEN $4 ELSE co.description END,
         teacher_id  = COALESCE($5::uuid, co.teacher_id),
         start_date  = COALESCE($6::date, co.start_date),
         end_date    = COALESCE($7::date, co.end_date)
       FROM classes cl
       WHERE co.id = $1 AND cl.id = co.class_id AND cl.school_id = $8
         AND ($5::uuid IS NULL OR EXISTS (
           SELECT 1 FROM users t WHERE t.id = $5::uuid AND t.role = 'teacher' AND t.school_id = $8))
       RETURNING ${COURSE_COLUMNS}`,
      [
        courseId,
        name?.trim() ?? null,
        hasDescription,
        body.description?.trim() || null,
        teacherId ?? null,
        startDate ?? null,
        endDate ?? null,
        req.user!.schoolId,
      ]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: 'Course or teacher not found in your school' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    if (!handleCourseError(err, res)) throw err;
  }
});

// DELETE /api/courses/:id — removes the course and its weekly lessons
router.delete('/:id', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = req.params.id;
  const { rowCount } = isUuid(courseId)
    ? await pool.query(
        `DELETE FROM courses co USING classes cl
         WHERE co.id = $1 AND cl.id = co.class_id AND cl.school_id = $2`,
        [courseId, req.user!.schoolId]
      )
    : { rowCount: 0 };

  if (rowCount === 0) {
    res.status(404).json({ message: 'Course not found' });
    return;
  }
  res.status(204).end();
});

interface LessonInput {
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string | null;
}

const isLessonInput = (value: unknown): value is LessonInput => {
  const lesson = value as LessonInput;
  return (
    typeof lesson === 'object' &&
    lesson !== null &&
    Number.isInteger(lesson.weekday) &&
    lesson.weekday >= 1 &&
    lesson.weekday <= 7 &&
    isTimeString(lesson.startTime) &&
    isTimeString(lesson.endTime) &&
    // "HH:MM" strings sort the same way as the times they describe
    lesson.startTime < lesson.endTime &&
    (lesson.room == null || (typeof lesson.room === 'string' && lesson.room.length <= 50))
  );
};

const LESSON_COLUMNS = `id, weekday, to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime", room`;

// GET /api/courses/:id/lessons — the course's weekly schedule
router.get('/:id/lessons', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = req.params.id;
  if (!isUuid(courseId)) {
    res.status(404).json({ message: 'Course not found' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT ${LESSON_COLUMNS} FROM lessons
     WHERE course_id = $1 AND class_id IN (SELECT id FROM classes WHERE school_id = $2)
     ORDER BY weekday, start_time`,
    [courseId, req.user!.schoolId]
  );
  res.json(rows);
});

// PUT /api/courses/:id/lessons — { lessons: [{ weekday: 1, startTime: "08:00", endTime: "08:50", room: "Sala 101" }] }
// Replaces the course's whole weekly schedule: all of it is saved, or none of it.
router.put('/:id/lessons', requireRole('school_admin'), requireSchool, async (req: AuthenticatedRequest, res) => {
  const courseId = req.params.id;
  const lessons: unknown = req.body?.lessons;

  if (!isUuid(courseId)) {
    res.status(404).json({ message: 'Course not found' });
    return;
  }
  if (!Array.isArray(lessons) || lessons.length > MAX_LESSONS_PER_COURSE || !lessons.every(isLessonInput)) {
    res.status(400).json({ message: 'Each lesson needs a weekday (1–7) and a start time before its end time' });
    return;
  }

  const saved = await withTransaction(async (client) => {
    // FOR UPDATE locks the course, so two admins saving its schedule at once take turns instead of mixing
    const course = await client.query(
      `SELECT co.id FROM courses co JOIN classes cl ON cl.id = co.class_id
       WHERE co.id = $1 AND cl.school_id = $2
       FOR UPDATE OF co`,
      [courseId, req.user!.schoolId]
    );
    if (course.rowCount === 0) throw new HttpError(404, 'Course not found');

    await client.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);

    // jsonb_to_recordset turns the JSON array into rows, so every lesson goes in with one INSERT.
    // The class, teacher and dates are copied from the course for the clash constraints.
    const { rows } = await client.query(
      `INSERT INTO lessons (course_id, class_id, teacher_id, start_date, end_date, weekday, start_time, end_time, room)
       SELECT co.id, co.class_id, co.teacher_id, co.start_date, co.end_date, x.weekday, x.start_time, x.end_time, x.room
       FROM courses co,
            jsonb_to_recordset($2::jsonb) AS x(weekday smallint, start_time time, end_time time, room text)
       WHERE co.id = $1
       RETURNING ${LESSON_COLUMNS}`,
      [
        courseId,
        JSON.stringify(
          lessons.map(({ weekday, startTime, endTime, room }) => ({
            weekday,
            start_time: startTime,
            end_time: endTime,
            room: room?.trim() || null,
          }))
        ),
      ]
    );
    return rows;
  }).catch((err) => {
    if (isPgError(err, PG_ERRORS.exclusionViolation)) throw new HttpError(409, CLASH_MESSAGE, 'LESSON_CLASH');
    throw err;
  });

  res.json(saved.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)));
});

export default router;
