import { pool } from '../../db/pool.js';

export interface SchoolStats {
  studentsCount: number;
  teachersCount: number;
  adminsCount: number;
  classesCount: number;
}

// Counts for one school, or for every school when schoolId is null
export async function getStats(schoolId: string | null) {
  const { rows } = await pool.query<SchoolStats>(
    `SELECT
       COUNT(*) FILTER (WHERE role = 'student')::int      AS "studentsCount",
       COUNT(*) FILTER (WHERE role = 'teacher')::int      AS "teachersCount",
       COUNT(*) FILTER (WHERE role = 'school_admin')::int AS "adminsCount",
       (SELECT COUNT(*)::int FROM classes WHERE $1::uuid IS NULL OR school_id = $1::uuid) AS "classesCount"
     FROM users
     WHERE $1::uuid IS NULL OR school_id = $1::uuid`,
    [schoolId],
  );
  return rows[0]!;
}
