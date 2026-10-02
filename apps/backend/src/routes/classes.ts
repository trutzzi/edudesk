import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from '../middleware/auth.js';
import { isNonEmptyString, isPgError, isUuid, PG_ERRORS } from '../utils/validation.js';

const router = express.Router();

const SCHOOL_YEAR_PATTERN = /^\d{4}-\d{4}$/;

// Every route below needs a signed-in user who belongs to a school
router.use(authenticateJWT, requireSchool);

// requireSchool guarantees schoolId is set
const schoolIdOf = (req: AuthenticatedRequest) => req.user!.schoolId!;

// GET /api/classes — every class in the caller's school, with how many students it has
router.get('/', requireRole('school_admin', 'teacher'), async (req: AuthenticatedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.school_year AS "schoolYear", COUNT(cs.student_id)::int AS "studentsCount"
     FROM classes c
     LEFT JOIN class_students cs ON cs.class_id = c.id
     WHERE c.school_id = $1
     GROUP BY c.id
     -- Shorter names first, so "9A" comes before "10A"
     ORDER BY c.school_year DESC, length(c.name), c.name`,
    [schoolIdOf(req)]
  );
  res.json(rows);
});

// POST /api/classes — { name: "9A", schoolYear: "2026-2027" }
router.post('/', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { name, schoolYear } = req.body ?? {};

  if (!isNonEmptyString(name) || typeof schoolYear !== 'string' || !SCHOOL_YEAR_PATTERN.test(schoolYear)) {
    res.status(400).json({ message: 'Name and school year (e.g. 2026-2027) are required' });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO classes (school_id, name, school_year)
       VALUES ($1, $2, $3)
       RETURNING id, name, school_year AS "schoolYear"`,
      [schoolIdOf(req), name.trim(), schoolYear]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) {
      res.status(409).json({ message: 'This class already exists for that school year' });
      return;
    }
    throw err;
  }
});

// GET /api/classes/taught — for a teacher: the classes they teach, each with its students
router.get('/taught', requireRole('teacher'), async (req: AuthenticatedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.school_year AS "schoolYear",
            COALESCE(
              json_agg(json_build_object('id', u.id, 'firstName', u.first_name, 'lastName', u.last_name, 'email', u.email)
                       ORDER BY u.last_name, u.first_name)
                FILTER (WHERE u.id IS NOT NULL),
              '[]') AS students
     FROM classes c
     LEFT JOIN class_students cs ON cs.class_id = c.id
     LEFT JOIN users u ON u.id = cs.student_id
     WHERE c.school_id = $1 AND EXISTS (SELECT 1 FROM courses co WHERE co.class_id = c.id AND co.teacher_id = $2)
     GROUP BY c.id
     -- Shorter names first, so "9A" comes before "10A"
     ORDER BY c.school_year DESC, length(c.name), c.name`,
    [req.user!.schoolId, req.user!.id]
  );
  res.json(rows);
});

// GET /api/classes/:id — the class with its students and courses
router.get('/:id', requireRole('school_admin', 'teacher'), async (req: AuthenticatedRequest, res) => {
  const classId = req.params.id;
  if (!isUuid(classId)) {
    res.status(404).json({ message: 'Class not found' });
    return;
  }

  const { rows } = await pool.query(
    'SELECT id, name, school_year AS "schoolYear" FROM classes WHERE id = $1 AND school_id = $2',
    [classId, schoolIdOf(req)]
  );
  if (rows.length === 0) {
    res.status(404).json({ message: 'Class not found' });
    return;
  }

  // The two lists don't depend on each other, so fetch them at the same time
  const [students, courses] = await Promise.all([
    pool.query(
      `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email
       FROM class_students cs
       JOIN users u ON u.id = cs.student_id
       WHERE cs.class_id = $1
       ORDER BY u.last_name, u.first_name`,
      [classId]
    ),
    pool.query(
      `SELECT co.id, co.name, co.description,
              co.start_date::text AS "startDate", co.end_date::text AS "endDate",
              t.id AS "teacherId", t.first_name AS "teacherFirstName", t.last_name AS "teacherLastName",
              (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = co.id) AS "lessonsCount"
       FROM courses co
       JOIN users t ON t.id = co.teacher_id
       WHERE co.class_id = $1
       ORDER BY co.name`,
      [classId]
    ),
  ]);

  res.json({ ...rows[0], students: students.rows, courses: courses.rows });
});

// DELETE /api/classes/:id — the class with its courses, weekly lessons and class events.
// Students stay in the school; they're just no longer in this class.
router.delete('/:id', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const classId = req.params.id;
  const { rowCount } = isUuid(classId)
    ? await pool.query('DELETE FROM classes WHERE id = $1 AND school_id = $2', [classId, schoolIdOf(req)])
    : { rowCount: 0 };

  if (rowCount === 0) {
    res.status(404).json({ message: 'Class not found' });
    return;
  }
  res.status(204).end();
});

// POST /api/classes/:id/students — { studentId }
router.post('/:id/students', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const classId = req.params.id;
  const { studentId } = req.body ?? {};

  if (!isUuid(classId) || !isUuid(studentId)) {
    res.status(400).json({ message: 'A valid class and student are required' });
    return;
  }

  try {
    // INSERT ... SELECT only inserts when both the class and the student belong to the caller's school
    const { rowCount } = await pool.query(
      `INSERT INTO class_students (class_id, student_id)
       SELECT c.id, s.id
       FROM classes c, users s
       WHERE c.id = $1 AND c.school_id = $3
         AND s.id = $2 AND s.school_id = $3 AND s.role = 'student'`,
      [classId, studentId, schoolIdOf(req)]
    );
    if (rowCount === 0) {
      res.status(404).json({ message: 'Class or student not found in your school' });
      return;
    }
    res.status(201).json({ classId, studentId });
  } catch (err) {
    if (isPgError(err, PG_ERRORS.uniqueViolation)) {
      res.status(409).json({ message: 'The student is already in this class' });
      return;
    }
    throw err;
  }
});

// DELETE /api/classes/:id/students/:studentId
router.delete('/:id/students/:studentId', requireRole('school_admin'), async (req: AuthenticatedRequest, res) => {
  const { id: classId, studentId } = req.params;

  if (!isUuid(classId) || !isUuid(studentId)) {
    res.status(404).json({ message: 'Student not found in this class' });
    return;
  }

  const { rowCount } = await pool.query(
    `DELETE FROM class_students cs
     USING classes c
     WHERE cs.class_id = c.id AND c.id = $1 AND c.school_id = $3 AND cs.student_id = $2`,
    [classId, studentId, schoolIdOf(req)]
  );
  if (rowCount === 0) {
    res.status(404).json({ message: 'Student not found in this class' });
    return;
  }
  res.status(204).end();
});

export default router;
