import type { PoolClient } from 'pg';
import { pool } from '../../db/pool.js';
import type { SchoolRole } from '../../lib/roles.js';

export interface UserRow {
  id: string;
  // Admin-created clients and therapists may have only a phone
  email: string | null;
  phone: string | null;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  school_id: string | null;
  email_verified_at: Date | null;
}

export const PAYMENT_TYPES = ['cas', 'sponsored'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];
export const isPaymentType = (value: unknown): value is PaymentType => PAYMENT_TYPES.includes(value as PaymentType);

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: SchoolRole;
  // A client's; null for everyone else
  paymentType: PaymentType | null;
  details: string | null;
  notes: string | null;
  // The app's language for them; null follows their browser
  locale: 'ro' | 'en' | null;
  // A therapist's therapies; empty for everyone else
  specializations: { id: string; name: string }[];
}

const MEMBER_COLUMNS = `u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email, u.phone, u.role,
  u.payment_type AS "paymentType", u.details, u.notes, u.locale,
  COALESCE((SELECT json_agg(json_build_object('id', th.id, 'name', th.name) ORDER BY th.name)
            FROM therapist_specializations s JOIN therapies th ON th.id = s.therapy_id
            WHERE s.teacher_id = u.id), '[]') AS specializations`;

export async function findUserByEmail(email: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE lower(email) = $1', [email.trim().toLowerCase()]);
  return rows[0];
}

export async function findUserByPhone(phone: string) {
  const { rows } = await pool.query<UserRow>('SELECT * FROM users WHERE phone = $1', [phone]);
  return rows[0];
}

// The school's members, of one role or all of them
export async function listMembers(schoolId: string, role: SchoolRole | null) {
  const { rows } = await pool.query<Member>(
    `SELECT ${MEMBER_COLUMNS}
     FROM users u
     WHERE u.school_id = $1 AND ($2::user_role IS NULL OR u.role = $2::user_role)
     ORDER BY u.last_name, u.first_name`,
    [schoolId, role],
  );
  return rows;
}

// Anyone's own account, school or not
export async function findProfile(userId: string, client: PoolClient | typeof pool = pool) {
  const { rows } = await client.query<Member>(`SELECT ${MEMBER_COLUMNS} FROM users u WHERE u.id = $1`, [userId]);
  return rows[0];
}

export async function findPasswordHash(userId: string) {
  const { rows } = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return rows[0]?.password_hash;
}

export async function findMember(userId: string, schoolId: string, client: PoolClient | typeof pool = pool) {
  const { rows } = await client.query<Member>(`SELECT ${MEMBER_COLUMNS} FROM users u WHERE u.id = $1 AND u.school_id = $2`, [
    userId,
    schoolId,
  ]);
  return rows[0];
}

export interface NewMember {
  role: 'teacher' | 'student';
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  paymentType: PaymentType | null;
  details: string | null;
  notes: string | null;
  specializations: string[];
  classId: string | null;
}

// An account made by the school's admin: confirmed straight away, since the admin vouches for it.
// Returns the new id, or undefined when the room or a therapy isn't the school's.
export async function insertMember(client: PoolClient, schoolId: string, member: NewMember) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO users (school_id, role, first_name, last_name, email, phone, password_hash, payment_type, details, notes,
                        email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     RETURNING id`,
    [
      schoolId,
      member.role,
      member.firstName,
      member.lastName,
      member.email,
      member.phone,
      member.passwordHash,
      member.paymentType,
      member.details,
      member.notes,
    ],
  );
  const id = rows[0]!.id;
  if ((await replaceSpecializations(client, id, schoolId, member.specializations)) !== member.specializations.length) return undefined;
  if (member.classId) {
    const placed = await client.query(
      `INSERT INTO class_students (class_id, student_id) SELECT id, $2 FROM classes WHERE id = $1 AND school_id = $3`,
      [member.classId, id, schoolId],
    );
    if (!placed.rowCount) return undefined;
  }
  return id;
}

export interface MemberChanges {
  firstName?: string | undefined;
  lastName?: string | undefined;
  // null clears it
  email?: string | null | undefined;
  phone?: string | null | undefined;
  passwordHash?: string | undefined;
  paymentType?: PaymentType | null | undefined;
  details?: string | null | undefined;
  notes?: string | null | undefined;
  locale?: 'ro' | 'en' | null | undefined;
}

const CHANGE_COLUMNS: Record<keyof MemberChanges, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  passwordHash: 'password_hash',
  paymentType: 'payment_type',
  details: 'details',
  notes: 'notes',
  locale: 'locale',
};

// Changes only the fields given. Column names come from CHANGE_COLUMNS, never from input.
export async function updateMember(client: PoolClient, userId: string, changes: MemberChanges) {
  const fields = (Object.keys(changes) as (keyof MemberChanges)[]).filter((key) => changes[key] !== undefined);
  if (fields.length === 0) return;
  await client.query(`UPDATE users SET ${fields.map((key, i) => `${CHANGE_COLUMNS[key]} = $${i + 2}`).join(', ')} WHERE id = $1`, [
    userId,
    ...fields.map((key) => changes[key]),
  ]);
}

// Sets a therapist's specializations to these therapies of the school. Returns how many were saved, so a caller
// can tell when some ids weren't the school's.
export async function replaceSpecializations(client: PoolClient, teacherId: string, schoolId: string, therapyIds: string[]) {
  await client.query('DELETE FROM therapist_specializations WHERE teacher_id = $1', [teacherId]);
  if (therapyIds.length === 0) return 0;
  const { rowCount } = await client.query(
    `INSERT INTO therapist_specializations (teacher_id, therapy_id)
     SELECT $1, id FROM therapies WHERE school_id = $2 AND id = ANY($3::uuid[])`,
    [teacherId, schoolId, therapyIds],
  );
  return rowCount ?? 0;
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
