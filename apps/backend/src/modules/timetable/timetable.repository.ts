import { pool } from '../../db/pool.js';

const DEFAULT_TIMEZONE = 'Europe/Bucharest';

export async function timezoneOf(schoolId: string | null) {
  if (!schoolId) return DEFAULT_TIMEZONE;
  const { rows } = await pool.query<{ timezone: string }>('SELECT timezone FROM schools WHERE id = $1', [schoolId]);
  return rows[0]?.timezone ?? DEFAULT_TIMEZONE;
}

// Courses running at any point between from and to (two periods overlap when each starts before the other ends)
export interface CourseInRange {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  class: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
}

export async function listCoursesBetween(schoolId: string, from: string, to: string) {
  const { rows } = await pool.query<CourseInRange>(
    `SELECT co.id, co.name,
            co.start_date::text AS "startDate", co.end_date::text AS "endDate",
            json_build_object('id', cl.id, 'name', cl.name) AS class,
            json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name) AS teacher
     FROM courses co
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     WHERE cl.school_id = $1 AND co.start_date <= $3::date AND co.end_date >= $2::date
     ORDER BY cl.name, co.name`,
    [schoolId, from, to],
  );
  return rows;
}
