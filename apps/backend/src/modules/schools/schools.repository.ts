import type { PoolClient } from 'pg';
import type { UserRow } from '../users/users.repository.js';

export async function createSchool(client: PoolClient, name: string, code: string, timezone: string) {
  const { rows } = await client.query<{ id: string }>('INSERT INTO schools (name, code, timezone) VALUES ($1, $2, $3) RETURNING id', [
    name,
    code,
    timezone,
  ]);
  return rows[0]!.id;
}

// Links the user to the school unless they already have one. Checked in the database rather than
// the session token, which may be older than a link made since.
export async function linkUserToSchool(client: PoolClient, userId: string, schoolId: string) {
  const { rows } = await client.query<UserRow>('UPDATE users SET school_id = $1 WHERE id = $2 AND school_id IS NULL RETURNING *', [
    schoolId,
    userId,
  ]);
  return rows[0];
}
