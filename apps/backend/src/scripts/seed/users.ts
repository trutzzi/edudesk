import type { PoolClient } from 'pg';

export async function insertUser(
  client: PoolClient,
  schoolId: string,
  passwordHash: string,
  user: { firstName: string; lastName: string; email: string; role: string },
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (school_id, email, password_hash, first_name, last_name, role, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id`,
    [schoolId, user.email, passwordHash, user.firstName, user.lastName, user.role],
  );
  return rows[0]!.id;
}
