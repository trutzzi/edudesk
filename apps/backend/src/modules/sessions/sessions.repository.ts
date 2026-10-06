import { pool } from '../../db/pool.js';
import type { Role } from '../../lib/roles.js';

export const ATTENDANCE_STATUSES = ['present', 'absent_notice', 'absent_late', 'cancelled'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const isAttendanceStatus = (value: unknown): value is AttendanceStatus => ATTENDANCE_STATUSES.includes(value as AttendanceStatus);

// Whose sessions to list. Each is a fixed SQL condition over cl (classes), co (courses) and c (the client); $3 is the id.
const SESSION_SCOPES = {
  school: 'cl.school_id = $3',
  // The sessions a therapist holds
  teacher: 'co.teacher_id = $3',
  client: 'c.id = $3',
  // Every session of the clients a therapist has in therapy, whoever holds it
  teacherClients: `c.id IN (
    SELECT cs2.student_id FROM class_students cs2 JOIN courses co2 ON co2.class_id = cs2.class_id WHERE co2.teacher_id = $3)`,
} as const;
export type SessionScope = keyof typeof SESSION_SCOPES;

interface PersonRef {
  id: string;
  firstName: string;
  lastName: string;
}

// One client at one session: a course's weekly lesson on a real day
export interface ClientSession {
  schoolId: string;
  courseId: string;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  room: string | null;
  class: { id: string; name: string };
  teacher: PersonRef;
  client: PersonRef;
  // The latest mark; "present" when nobody marked it
  status: AttendanceStatus;
  markedAt: string | null;
}

// Every client's every session between from and to, like the timetable's lessonsBetween but once per client in
// the room, from the day they joined it. Holidays have none. The latest attendance mark gives the status.
export async function sessionsBetween(from: string, to: string, scope: SessionScope, id: string) {
  const { rows } = await pool.query<ClientSession>(
    `SELECT cl.school_id AS "schoolId", co.id AS "courseId", co.name AS "courseName", day::date::text AS date,
            to_char(l.start_time, 'HH24:MI') AS "startTime", to_char(l.end_time, 'HH24:MI') AS "endTime",
            (EXTRACT(EPOCH FROM l.end_time - l.start_time) / 3600)::float AS hours, l.room,
            json_build_object('id', cl.id, 'name', cl.name) AS class,
            json_build_object('id', t.id, 'firstName', t.first_name, 'lastName', t.last_name) AS teacher,
            json_build_object('id', c.id, 'firstName', c.first_name, 'lastName', c.last_name) AS client,
            COALESCE(m.status, 'present') AS status, m.marked_at AS "markedAt"
     FROM lessons l
     JOIN courses co ON co.id = l.course_id
     JOIN classes cl ON cl.id = co.class_id
     JOIN users t ON t.id = co.teacher_id
     JOIN schools sc ON sc.id = cl.school_id
     JOIN class_students cs ON cs.class_id = cl.id
     JOIN users c ON c.id = cs.student_id
     CROSS JOIN LATERAL generate_series(
       GREATEST($1::date, co.start_date, cs.joined_at::date), LEAST($2::date, co.end_date), interval '1 day') AS day
     LEFT JOIN LATERAL (
       SELECT am.status, am.marked_at FROM attendance_marks am
       WHERE am.course_id = co.id AND am.date = day::date AND am.start_time = l.start_time AND am.student_id = c.id
       ORDER BY am.marked_at DESC LIMIT 1
     ) m ON TRUE
     WHERE ${SESSION_SCOPES[scope]} AND EXTRACT(ISODOW FROM day) = l.weekday
       AND NOT EXISTS (
         SELECT 1 FROM school_events e
         WHERE e.school_id = cl.school_id AND e.kind = 'holiday'
           AND day::date BETWEEN e.start_date AND e.end_date
           AND (e.class_id IS NULL OR e.class_id = cl.id))
       AND NOT EXISTS (SELECT 1 FROM public_holidays ph WHERE ph.country = sc.country AND ph.date = day::date)
     ORDER BY day, l.start_time, cl.name, c.last_name, c.first_name`,
    [from, to, id],
  );
  return rows;
}

export interface NewMark {
  courseId: string;
  studentId: string;
  date: string;
  startTime: string;
  status: AttendanceStatus;
  markedBy: string;
}

// Marks are only ever added: the newest one is the status, the older ones are the history
export async function insertMark(mark: NewMark) {
  await pool.query(
    `INSERT INTO attendance_marks (course_id, student_id, date, start_time, status, marked_by) VALUES ($1, $2, $3, $4, $5, $6)`,
    [mark.courseId, mark.studentId, mark.date, mark.startTime, mark.status, mark.markedBy],
  );
}

// Today's date where the school is, which may differ from the server's
export async function schoolToday(schoolId: string) {
  const { rows } = await pool.query<{ today: string }>(
    `SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM schools WHERE id = $1`,
    [schoolId],
  );
  return rows[0]!.today;
}

export interface ClientProfile extends PersonRef {
  email: string | null;
  phone: string | null;
  paymentType: string | null;
  details: string | null;
  notes: string | null;
  rooms: { id: string; name: string }[];
}

// Which clients each role may open, as fixed SQL conditions: $2 is the school for admins and the caller otherwise
const VISIBLE_CLIENTS: Partial<Record<Role, string>> = {
  school_admin: 'c.school_id = $2',
  teacher: `c.id IN (
    SELECT cs.student_id FROM class_students cs JOIN courses co ON co.class_id = cs.class_id WHERE co.teacher_id = $2)`,
  student: 'c.id = $2',
};

// A client the caller may see, or undefined
export async function findVisibleClient(clientId: string, user: { id: string; role: Role; schoolId: string | null }) {
  const where = VISIBLE_CLIENTS[user.role];
  if (!where) return undefined;
  const { rows } = await pool.query<ClientProfile>(
    `SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.email, c.phone, c.payment_type AS "paymentType",
            c.details, c.notes,
            COALESCE((SELECT json_agg(json_build_object('id', cl.id, 'name', cl.name) ORDER BY cl.name)
                      FROM class_students cs JOIN classes cl ON cl.id = cs.class_id WHERE cs.student_id = c.id), '[]') AS rooms
     FROM users c
     WHERE c.id = $1 AND c.role = 'student' AND ${where}`,
    [clientId, user.role === 'school_admin' ? user.schoolId : user.id],
  );
  return rows[0];
}

// The clients in a therapist's rooms, for their list
export async function listTherapistClients(teacherId: string) {
  const { rows } = await pool.query<PersonRef & { phone: string | null; paymentType: string | null }>(
    `SELECT DISTINCT c.id, c.first_name AS "firstName", c.last_name AS "lastName", c.phone, c.payment_type AS "paymentType"
     FROM users c
     JOIN class_students cs ON cs.student_id = c.id
     JOIN courses co ON co.class_id = cs.class_id
     WHERE co.teacher_id = $1
     ORDER BY "lastName", "firstName"`,
    [teacherId],
  );
  return rows;
}
