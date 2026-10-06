import type { PoolClient } from 'pg';
import { insertDefaultTherapies } from '../../lib/therapies.js';
import type { UserRow } from '../users/users.repository.js';

// A new institution, with the default list of therapies to start from
export async function createSchool(client: PoolClient, name: string, code: string, timezone: string) {
  const { rows } = await client.query<{ id: string }>('INSERT INTO schools (name, code, timezone) VALUES ($1, $2, $3) RETURNING id', [
    name,
    code,
    timezone,
  ]);
  const schoolId = rows[0]!.id;
  await insertDefaultTherapies(client, schoolId);
  return schoolId;
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
