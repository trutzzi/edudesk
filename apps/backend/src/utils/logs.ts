import { pool } from '../db.js';

// A request taking at least this long is logged as slow
export const SLOW_REQUEST_MS = 1000;
const RETENTION_DAYS = 30;

export interface LogEntry {
  level: 'error' | 'warn';
  source: 'api' | 'web';
  method?: string | undefined;
  path: string;
  status?: number | undefined;
  durationMs?: number | undefined;
  message?: string | undefined;
  code?: string | undefined;
  detail?: string | undefined;
  userId?: string | undefined;
  schoolId?: string | null | undefined;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// "/api/classes/4f56…?x=1" → "/api/classes/:id": groups requests by route and keeps tokens and
// personal details that travel in query strings out of the log
export const normalizePath = (url: string) => (url.split('?')[0] ?? url).replace(UUID, ':id').slice(0, 500);

const clip = (text: string | undefined, length: number) => (text === undefined ? null : text.slice(0, length));

// Saves a log entry. Logging must never break the request it describes, so failures only reach the console.
export async function recordLog(entry: LogEntry) {
  try {
    await pool.query(
      `INSERT INTO api_logs (level, source, method, path, status, duration_ms, message, code, detail, user_id, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        entry.level,
        entry.source,
        entry.method ?? null,
        entry.path,
        entry.status ?? null,
        entry.durationMs ?? null,
        clip(entry.message, 1000),
        clip(entry.code, 50),
        clip(entry.detail, 8000),
        entry.userId ?? null,
        entry.schoolId ?? null,
      ]
    );
  } catch (err) {
    console.error('Could not save a log entry:', err);
  }
}

// Deletes entries past the retention period
export async function pruneLogs() {
  try {
    const { rowCount } = await pool.query(`DELETE FROM api_logs WHERE created_at < now() - make_interval(days => $1)`, [
      RETENTION_DAYS,
    ]);
    if (rowCount) console.log(`Removed ${rowCount} log entries older than ${RETENTION_DAYS} days`);
  } catch (err) {
    console.error('Could not prune old log entries:', err);
  }
}
