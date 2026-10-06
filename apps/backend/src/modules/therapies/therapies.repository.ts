import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';

export interface Therapy {
  id: string;
  name: string;
  // How many courses run it and how many therapists have it, so the admin knows what a change touches
  coursesCount: number;
  therapistsCount: number;
}

export async function listTherapies(schoolId: string) {
  const { rows } = await pool.query<Therapy>(
    `SELECT th.id, th.name,
            (SELECT COUNT(*)::int FROM courses co JOIN classes cl ON cl.id = co.class_id
             WHERE cl.school_id = th.school_id AND co.name = th.name) AS "coursesCount",
            (SELECT COUNT(*)::int FROM therapist_specializations ts WHERE ts.therapy_id = th.id) AS "therapistsCount"
     FROM therapies th
     WHERE th.school_id = $1
     ORDER BY th.name`,
    [schoolId],
  );
  return rows;
}

export async function insertTherapy(schoolId: string, name: string) {
  const { rows } = await pool.query<{ id: string; name: string }>(
    'INSERT INTO therapies (school_id, name) VALUES ($1, $2) RETURNING id, name',
    [schoolId, name],
  );
  return rows[0]!;
}

// Locks the therapy for a rename or delete; undefined when it isn't the school's
export async function lockTherapy(client: PoolClient, therapyId: string, schoolId: string) {
  const { rows } = await client.query<{ name: string }>('SELECT name FROM therapies WHERE id = $1 AND school_id = $2 FOR UPDATE', [
    therapyId,
    schoolId,
  ]);
  return rows[0];
}

// Courses store the therapy's name, so they're renamed along with it
export async function renameTherapy(client: PoolClient, therapyId: string, schoolId: string, oldName: string, newName: string) {
  await client.query('UPDATE therapies SET name = $2 WHERE id = $1', [therapyId, newName]);
  await client.query(
    `UPDATE courses co SET name = $3 FROM classes cl
     WHERE cl.id = co.class_id AND cl.school_id = $1 AND co.name = $2`,
    [schoolId, oldName, newName],
  );
}

export async function countCoursesNamed(client: PoolClient, schoolId: string, name: string) {
  const { rows } = await client.query<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM courses co JOIN classes cl ON cl.id = co.class_id WHERE cl.school_id = $1 AND co.name = $2',
    [schoolId, name],
  );
  return rows[0]!.count;
}

// Removes it, and with it the therapists' specializations in it
export async function deleteTherapy(client: PoolClient, therapyId: string) {
  await client.query('DELETE FROM therapies WHERE id = $1', [therapyId]);
}

export async function therapyExists(schoolId: string, name: string) {
  const { rowCount } = await pool.query('SELECT 1 FROM therapies WHERE school_id = $1 AND name = $2', [schoolId, name]);
  return Boolean(rowCount);
}
