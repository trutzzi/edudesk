import { pool } from '../../db/pool.js';
import { TEACHER_JSON } from '../../db/sql.js';

// Whose lessons to list. Each is a fixed SQL condition over cl (classes) and co (courses); $3 is the id.
export const LESSON_SCOPES = {
  school: 'cl.school_id = $3',
  teacher: 'co.teacher_id = $3',
  student: 'cl.id IN (SELECT class_id FROM class_students WHERE student_id = $3)',
  parent: `cl.id IN (
    SELECT cs.class_id FROM class_students cs
    JOIN parent_student ps ON ps.student_id = cs.student_id
    WHERE ps.parent_id = $3)`,
} as const;
export type LessonScope = keyof typeof LESSON_SCOPES;

export interface DatedLesson {
  id: string;
  courseId: string;
  courseName: string;
  room: string | null;
  date: string;
  startTime: string;
  endTime: string;
  class: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
}

// Every lesson on every real day between from and to, for a school, a teacher, a student or a parent's children.
// generate_series lists each day a course runs within the range; keeping the days whose weekday matches turns
// "every Monday 08:00" into dated lessons. Times stay wall-clock times at the school, so daylight saving never
// moves a lesson. School holidays (for the school or the class) and the country's public holidays have none.
export async function lessonsBetween(from: string, to: string, scope: LessonScope, id: string) {
  const { rows } = await pool.query<DatedLesson>(
    `SELECT l.id, co.id AS "courseId", co.name AS "courseName", l.room,
            day::date::text AS date,
            to_char(l.start_time, 'HH24:MI') AS "startTime", to_char(l.end_time, 'HH24:MI') AS "endTime",
            json_build_object('id', cl.id, 'name', cl.name) AS class,
            ${TEACHER_JSON} AS teacher
     FROM lessons l
     JOIN courses co ON co.id = l.course_id
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     JOIN schools sc ON sc.id = cl.school_id
     CROSS JOIN LATERAL generate_series(
       GREATEST($1::date, co.start_date), LEAST($2::date, co.end_date), interval '1 day') AS day
     WHERE ${LESSON_SCOPES[scope]} AND EXTRACT(ISODOW FROM day) = l.weekday
       AND NOT EXISTS (
         SELECT 1 FROM school_events e
         WHERE e.school_id = cl.school_id AND e.kind = 'holiday'
           AND day::date BETWEEN e.start_date AND e.end_date
           AND (e.class_id IS NULL OR e.class_id = cl.id))
       AND NOT EXISTS (SELECT 1 FROM public_holidays ph WHERE ph.country = sc.country AND ph.date = day::date)
     ORDER BY day, l.start_time, cl.name`,
    [from, to, id],
  );
  return rows;
}
