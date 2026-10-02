import { pool } from '../db.js';

// Lessons on real days between `from` and `to`, limited by `where` (SQL over cl = classes, co = courses).
// `where` must be a fixed string from the code, never user input; its placeholders start at $3.
export async function lessonsBetween(from: string, to: string, where: string, params: unknown[]) {
  // generate_series lists each day the course runs inside the range; keeping the days whose
  // weekday matches turns "every Monday 08:00" into "Mon 5 Oct 08:00", "Mon 12 Oct 08:00", …
  // Times stay wall-clock times at the school, so daylight saving never moves a lesson.
  // Days inside a school holiday (for the whole school or this class) or on a national public holiday
  // of the school's country have no lessons.
  const { rows } = await pool.query(
    `SELECT l.id, co.id AS "courseId", co.name AS "courseName", l.room,
            day::date::text AS date,
            to_char(l.start_time, 'HH24:MI') AS "startTime", to_char(l.end_time, 'HH24:MI') AS "endTime",
            json_build_object('id', cl.id, 'name', cl.name) AS class,
            json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name) AS teacher
     FROM lessons l
     JOIN courses co ON co.id = l.course_id
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     JOIN schools sc ON sc.id = cl.school_id
     CROSS JOIN LATERAL generate_series(
       GREATEST($1::date, co.start_date), LEAST($2::date, co.end_date), interval '1 day') AS day
     WHERE ${where} AND EXTRACT(ISODOW FROM day) = l.weekday
       AND NOT EXISTS (
         SELECT 1 FROM school_events e
         WHERE e.school_id = cl.school_id AND e.kind = 'holiday'
           AND day::date BETWEEN e.start_date AND e.end_date
           AND (e.class_id IS NULL OR e.class_id = cl.id))
       AND NOT EXISTS (SELECT 1 FROM public_holidays ph WHERE ph.country = sc.country AND ph.date = day::date)
     ORDER BY day, l.start_time, cl.name`,
    [from, to, ...params]
  );
  return rows;
}

export const timezoneOf = async (schoolId: string | null) =>
  (schoolId &&
    (await pool.query<{ timezone: string }>('SELECT timezone FROM schools WHERE id = $1', [schoolId])).rows[0]
      ?.timezone) ||
  'Europe/Bucharest';
