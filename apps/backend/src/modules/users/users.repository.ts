import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { SchoolRole } from '../../lib/roles.js';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string | null;
  email_verified_at: Date | null;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: SchoolRole;
}

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1', [email.trim().toLowerCase()]);
  return rows[0];
}

// The school's members, of one role or all of them
export async function listMembers(schoolId: string, role: SchoolRole | null) {
  const { rows } = await pool.query<Member>(
    `SELECT id, first_name AS "firstName", last_name AS "lastName", email, role
     FROM users
     WHERE school_id = $1 AND ($2::user_role IS NULL OR role = $2::user_role)
     ORDER BY last_name, first_name`,
    [schoolId, role],
  );
  return rows;
}

export async function lockMember(client: PoolClient, userId: string, schoolId: string) {
  const { rows } = await client.query<{ role: string }>('SELECT role FROM users WHERE id = $1 AND school_id = $2 FOR UPDATE', [
    userId,
    schoolId,
  ]);
  return rows[0];
}

export async function countTaughtCourses(client: PoolClient, teacherId: string) {
  const { rowCount } = await client.query('SELECT 1 FROM courses WHERE teacher_id = $1', [teacherId]);
  return rowCount ?? 0;
}

// Unlinks someone from their school, with their class places and family links; the account stays
export async function unlinkFromSchool(client: PoolClient, userId: string) {
  await client.query('DELETE FROM class_students WHERE student_id = $1', [userId]);
  await client.query('DELETE FROM parent_student WHERE parent_id = $1 OR student_id = $1', [userId]);
  await client.query('UPDATE users SET school_id = NULL WHERE id = $1', [userId]);
}
