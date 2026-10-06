import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

// A made-up Romanian mobile number (+40 73x xxx xxx) derived from the email, so every sample account gets its own
// and a rerun gives the same one
const samplePhone = (email: string) => {
  const digits = BigInt(`0x${createHash('sha256').update(email).digest('hex').slice(0, 12)}`) % 10_000_000n;
  return `+4073${digits.toString().padStart(7, '0')}`;
};

export async function insertUser(
  client: PoolClient,
  schoolId: string,
  passwordHash: string,
  user: { firstName: string; lastName: string; email: string; role: string; paymentType?: 'cas' | 'sponsored' },
) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (school_id, email, phone, password_hash, first_name, last_name, role, payment_type, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     RETURNING id`,
    [schoolId, user.email, samplePhone(user.email), passwordHash, user.firstName, user.lastName, user.role, user.paymentType ?? null],
  );
  return rows[0]!.id;
}

// The therapist may run this therapy; sample courses only go to therapists who have it. The therapy is added to
// the institution's list if its admin removed it.
export async function addSpecialization(client: PoolClient, teacherId: string, therapy: string) {
  await client.query('INSERT INTO therapies (school_id, name) SELECT school_id, $2 FROM users WHERE id = $1 ON CONFLICT DO NOTHING', [
    teacherId,
    therapy,
  ]);
  await client.query(
    `INSERT INTO therapist_specializations (teacher_id, therapy_id)
     SELECT u.id, th.id FROM users u JOIN therapies th ON th.school_id = u.school_id
     WHERE u.id = $1 AND th.name = $2
     ON CONFLICT DO NOTHING`,
    [teacherId, therapy],
  );
}
