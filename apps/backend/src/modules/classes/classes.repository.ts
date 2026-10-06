import { pool } from '../../db/pool.js';
import { COURSE_DATES } from '../../db/sql.js';

export interface ClassBase {
  id: string;
  name: string;
  schoolYear: string;
}

export interface ClassSummary extends ClassBase {
  studentsCount: number;
}

export interface ClassStudent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface TaughtClass extends ClassBase {
  students: ClassStudent[];
}

export interface ClassCourse {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  teacherId: string;
  teacherFirstName: string;
  teacherLastName: string;
  lessonsCount: number;
}

// Shorter names first, so "9A" comes before "10A"
const CLASS_ORDER = 'c.school_year DESC, length(c.name), c.name';

export async function listClasses(schoolId: string) {
  const { rows } = await pool.query<ClassSummary>(
    `SELECT c.id, c.name, c.school_year AS "schoolYear", COUNT(cs.student_id)::int AS "studentsCount"
     FROM classes c
     LEFT JOIN class_students cs ON cs.class_id = c.id
     WHERE c.school_id = $1
     GROUP BY c.id
     ORDER BY ${CLASS_ORDER}`,
    [schoolId],
  );
  return rows;
}

export async function createClass(schoolId: string, name: string, schoolYear: string) {
  const { rows } = await pool.query<ClassBase>(
    `INSERT INTO classes (school_id, name, school_year)
     VALUES ($1, $2, $3)
     RETURNING id, name, school_year AS "schoolYear"`,
    [schoolId, name, schoolYear],
  );
  return rows[0];
}

export async function listTaughtClasses(schoolId: string, teacherId: string) {
  const { rows } = await pool.query<TaughtClass>(
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
     ORDER BY ${CLASS_ORDER}`,
    [schoolId, teacherId],
  );
  return rows;
}

export async function findClass(classId: string, schoolId: string) {
  const { rows } = await pool.query<ClassBase>(
    'SELECT id, name, school_year AS "schoolYear" FROM classes WHERE id = $1 AND school_id = $2',
    [classId, schoolId],
  );
  return rows[0];
}

export async function listClassStudents(classId: string) {
  const { rows } = await pool.query<ClassStudent>(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email
     FROM class_students cs
     JOIN users u ON u.id = cs.student_id
     WHERE cs.class_id = $1
     ORDER BY u.last_name, u.first_name`,
    [classId],
  );
  return rows;
}

export async function listClassCourses(classId: string) {
  const { rows } = await pool.query<ClassCourse>(
    `SELECT co.id, co.name, co.description,
            ${COURSE_DATES},
            t.id AS "teacherId", t.first_name AS "teacherFirstName", t.last_name AS "teacherLastName",
            (SELECT COUNT(*)::int FROM lessons l WHERE l.course_id = co.id) AS "lessonsCount"
     FROM courses co
     JOIN users t ON t.id = co.teacher_id
     WHERE co.class_id = $1
     ORDER BY co.name`,
    [classId],
  );
  return rows;
}

// Its courses, weekly lessons and class events go with it (ON DELETE CASCADE)
export async function deleteClass(classId: string, schoolId: string) {
  const { rowCount } = await pool.query('DELETE FROM classes WHERE id = $1 AND school_id = $2', [classId, schoolId]);
  return rowCount !== 0;
}

// Adds only when both the class and the student belong to the school; returns whether it did
export async function addStudentToClass(classId: string, studentId: string, schoolId: string) {
  const { rowCount } = await pool.query(
    `INSERT INTO class_students (class_id, student_id)
     SELECT c.id, s.id
     FROM classes c, users s
     WHERE c.id = $1 AND c.school_id = $3
       AND s.id = $2 AND s.school_id = $3 AND s.role = 'student'`,
    [classId, studentId, schoolId],
  );
  return rowCount !== 0;
}

export async function removeStudentFromClass(classId: string, studentId: string, schoolId: string) {
  const { rowCount } = await pool.query(
    `DELETE FROM class_students cs
     USING classes c
     WHERE cs.class_id = c.id AND c.id = $1 AND c.school_id = $3 AND cs.student_id = $2`,
    [classId, studentId, schoolId],
  );
  return rowCount !== 0;
}
