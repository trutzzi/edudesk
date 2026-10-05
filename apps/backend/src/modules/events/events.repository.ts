import { pool } from '../../db/pool.js';

export const EVENT_KINDS = ['holiday', 'exam', 'trip', 'meeting', 'other'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

const EVENT_COLUMNS = `e.id, e.title, e.kind, e.start_date::text AS "startDate", e.end_date::text AS "endDate",
  CASE WHEN cl.id IS NULL THEN NULL ELSE json_build_object('id', cl.id, 'name', cl.name) END AS class`;

export interface CalendarEvent {
  id: string;
  title: string;
  englishTitle?: string;
  kind: EventKind;
  startDate: string;
  endDate: string;
  class: { id: string; name: string } | null;
  national: boolean;
}

export async function listSchoolEvents(schoolId: string, from: string, to: string) {
  const { rows } = await pool.query<CalendarEvent>(
    `SELECT ${EVENT_COLUMNS}, false AS national
     FROM school_events e
     LEFT JOIN classes cl ON cl.id = e.class_id
     WHERE e.school_id = $1 AND e.start_date <= $3::date AND e.end_date >= $2::date`,
    [schoolId, from, to],
  );
  return rows;
}

// The public holidays of the school's country, shaped like events; they're edited in data/holidays
export async function listPublicHolidays(schoolId: string, from: string, to: string) {
  const { rows } = await pool.query<CalendarEvent>(
    `SELECT 'holiday-' || ph.country || '-' || ph.date AS id, ph.local_name AS title, ph.name AS "englishTitle",
            'holiday' AS kind, ph.date::text AS "startDate", ph.date::text AS "endDate", NULL AS class, true AS national
     FROM public_holidays ph JOIN schools s ON s.country = ph.country
     WHERE s.id = $1 AND ph.date BETWEEN $2::date AND $3::date`,
    [schoolId, from, to],
  );
  return rows;
}

interface NewEvent {
  schoolId: string;
  classId: string | null;
  title: string;
  kind: EventKind;
  startDate: string;
  endDate: string;
  createdBy: string;
}

// Inserts nothing (and returns undefined) when classId points to another school's class
export async function createEvent(event: NewEvent) {
  const { rows } = await pool.query<CalendarEvent>(
    `WITH e AS (
       INSERT INTO school_events (school_id, class_id, title, kind, start_date, end_date, created_by)
       SELECT $1, $2::uuid, $3, $4, $5, $6, $7
       WHERE $2::uuid IS NULL OR EXISTS (SELECT 1 FROM classes WHERE id = $2::uuid AND school_id = $1)
       RETURNING *
     )
     SELECT ${EVENT_COLUMNS} FROM e LEFT JOIN classes cl ON cl.id = e.class_id`,
    [event.schoolId, event.classId, event.title, event.kind, event.startDate, event.endDate, event.createdBy],
  );
  return rows[0];
}

export async function deleteEvent(eventId: string, schoolId: string) {
  const { rowCount } = await pool.query('DELETE FROM school_events WHERE id = $1 AND school_id = $2', [eventId, schoolId]);
  return rowCount !== 0;
}
