import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import { COURSE_DATES, TEACHER_JSON } from '../../db/sql.js';
import type { Role } from '../../lib/roles.js';
import type { WeeklyLesson } from './weeklyLessons.js';

// Which courses each role may see, as fixed SQL conditions; $1 is the school id for school admins and the
// user's id for everyone else. Picked by role, never built from input.
const VISIBLE_COURSES: Record<Role, { where: string; param: 'schoolId' | 'userId' | null }> = {
  super_admin: { where: 'TRUE', param: null },
  school_admin: { where: 'cl.school_id = $1', param: 'schoolId' },
  teacher: { where: 'co.teacher_id = $1', param: 'userId' },
  student: { where: 'co.class_id IN (SELECT class_id FROM class_students WHERE student_id = $1)', param: 'userId' },
  parent: {
    where: `co.class_id IN (
      SELECT cs.class_id FROM class_students cs
      JOIN parent_student ps ON ps.student_id = cs.student_id
      WHERE ps.parent_id = $1)`,
    param: 'userId',
  },
};

const COURSE_COLUMNS = `co.id, co.name, co.description,
  ${COURSE_DATES},
  co.class_id AS "classId", co.teacher_id AS "teacherId"`;

const LESSON_COLUMNS = `id, weekday, to_char(start_time, 'HH24:MI') AS "startTime",
  to_char(end_time, 'HH24:MI') AS "endTime", room`;

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CourseRow {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  classId: string;
  teacherId: string;
}

export interface VisibleCourse {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  class: { id: string; name: string; schoolYear: string };
  teacher: PersonRef;
}

export interface LessonRow {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

export async function listVisibleCourses(user: { id: string; role: Role; schoolId: string | null }) {
  const scope = VISIBLE_COURSES[user.role];
  const params = scope.param === 'schoolId' ? [user.schoolId] : scope.param === 'userId' ? [user.id] : [];
  const { rows } = await pool.query<VisibleCourse>(
    `SELECT co.id, co.name, co.description,
            ${COURSE_DATES},
            json_build_object('id', cl.id, 'name', cl.name, 'schoolYear', cl.school_year) AS class,
            ${TEACHER_JSON} AS teacher
     FROM courses co
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     WHERE ${scope.where}
     ORDER BY cl.name, co.name`,
    params,
  );
  return rows;
}

interface NewCourse {
  classId: string;
  teacherId: string;
  name: string;
  description: string | null;
  schoolId: string;
  startDate: string | null;
  endDate: string | null;
}

// Inserts only when the class is in the school and the teacher teaches there; without dates the course runs
// for its class's whole school year (1 Sep → 30 Jun). Returns undefined when nothing was inserted.
export async function createCourse(course: NewCourse) {
  const { rows } = await pool.query<CourseRow>(
    `INSERT INTO courses AS co (class_id, teacher_id, name, description, start_date, end_date)
     SELECT cl.id, t.id, $3, $4,
            COALESCE($6::date, make_date(split_part(cl.school_year, '-', 1)::int, 9, 1)),
            COALESCE($7::date, make_date(split_part(cl.school_year, '-', 2)::int, 6, 30))
     FROM classes cl, users t
     WHERE cl.id = $1 AND cl.school_id = $5
       AND t.id = $2 AND t.school_id = $5 AND t.role = 'teacher'
     RETURNING ${COURSE_COLUMNS}`,
    [course.classId, course.teacherId, course.name, course.description, course.schoolId, course.startDate, course.endDate],
  );
  return rows[0];
}

export interface CourseChanges {
  name: string | null;
  // undefined: leave as is; null: clear it
  description: string | null | undefined;
  teacherId: string | null;
  startDate: string | null;
  endDate: string | null;
}

// Changes only the fields given (COALESCE keeps the rest); returns undefined when the course or the new
// teacher isn't in the school
export async function updateCourse(courseId: string, schoolId: string, changes: CourseChanges) {
  const { rows } = await pool.query<CourseRow>(
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
      changes.name,
      changes.description !== undefined,
      changes.description ?? null,
      changes.teacherId,
      changes.startDate,
      changes.endDate,
      schoolId,
    ],
  );
  return rows[0];
}

// Whether a course's therapist has its therapy among their specializations. For a change, a missing teacher
// or name means the course keeps its current one. Undefined when the course doesn't exist.
export async function therapistHasTherapy(courseId: string | null, teacherId: string | null, name: string | null) {
  const { rows } = await pool.query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM therapist_specializations s JOIN therapies th ON th.id = s.therapy_id
       WHERE s.teacher_id = COALESCE($2::uuid, co.teacher_id) AND th.name = COALESCE($3, co.name)
     ) AS allowed
     FROM (SELECT NULL) AS nothing
     LEFT JOIN courses co ON co.id = $1::uuid
     WHERE $1::uuid IS NULL OR co.id IS NOT NULL`,
    [courseId, teacherId, name],
  );
  return rows[0]?.allowed;
}

export async function deleteCourse(courseId: string, schoolId: string) {
  const { rowCount } = await pool.query(
    `DELETE FROM courses co USING classes cl
     WHERE co.id = $1 AND cl.id = co.class_id AND cl.school_id = $2`,
    [courseId, schoolId],
  );
  return rowCount !== 0;
}

export async function listWeeklyLessons(courseId: string, schoolId: string) {
  const { rows } = await pool.query<LessonRow>(
    `SELECT ${LESSON_COLUMNS} FROM lessons
     WHERE course_id = $1 AND class_id IN (SELECT id FROM classes WHERE school_id = $2)
     ORDER BY weekday, start_time`,
    [courseId, schoolId],
  );
  return rows;
}

// Locks the course for the rest of the transaction, so two admins saving its schedule take turns
export async function lockCourse(client: PoolClient, courseId: string, schoolId: string) {
  const { rowCount } = await client.query(
    `SELECT co.id FROM courses co JOIN classes cl ON cl.id = co.class_id
     WHERE co.id = $1 AND cl.school_id = $2
     FOR UPDATE OF co`,
    [courseId, schoolId],
  );
  return rowCount !== 0;
}

// Swaps the course's weekly lessons for new ones, all in one INSERT (jsonb_to_recordset turns the list into rows).
// Each lesson copies the course's class, teacher and dates, which the clash constraints check.
export async function replaceWeeklyLessons(client: PoolClient, courseId: string, lessons: WeeklyLesson[]) {
  await client.query('DELETE FROM lessons WHERE course_id = $1', [courseId]);
  const { rows } = await client.query<{ weekday: number; startTime: string }>(
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
        })),
      ),
    ],
  );
  return rows.sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
}
