import { pool } from '../../db/pool.js';

// A request taking at least this long is logged as slow
export const SLOW_REQUEST_MS = 1000;
const RETENTION_DAYS = 30;

export interface LogEntry {
  level: LogLevel;
  source: LogSource;
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
      ],
    );
  } catch (err) {
    console.error('Could not save a log entry:', err);
  }
}

// Deletes entries past the retention period
export async function pruneLogs() {
  try {
    const { rowCount } = await pool.query(`DELETE FROM api_logs WHERE created_at < now() - make_interval(days => $1)`, [RETENTION_DAYS]);
    if (rowCount) console.info(`Removed ${rowCount} log entries older than ${RETENTION_DAYS} days`);
  } catch (err) {
    console.error('Could not prune old log entries:', err);
  }
}

export interface LogTotals {
  errors: number;
  warnings: number;
  slow: number;
  webErrors: number;
}

export interface TopPath {
  method: string;
  path: string;
  count: number;
  errors: number;
  commonStatus: number;
}

export interface TimelineBucket {
  start: Date;
  errors: number;
  warnings: number;
}

export interface LogRow {
  id: string;
  createdAt: Date;
  level: LogLevel;
  source: LogSource;
  method: string | null;
  path: string;
  status: number | null;
  durationMs: number | null;
  message: string | null;
  code: string | null;
  detail: string | null;
  user: { id: string; name: string; email: string } | null;
}

export type LogLevel = 'error' | 'warn';
export type LogSource = 'api' | 'web';

// The entries a viewer may see: one school's, or every school's (null) for a super admin
const IN_SCOPE = `($1::uuid IS NULL OR school_id = $1::uuid) AND created_at > now() - make_interval(hours => $2)`;

export async function pingDatabase() {
  const started = process.hrtime.bigint();
  await pool.query('SELECT 1');
  return Number(process.hrtime.bigint() - started) / 1_000_000;
}

// Totals, the endpoints with the most problems, and counts per hour (≤ 24h) or per day for a chart
export async function summarizeLogs(schoolId: string | null, hours: number) {
  const params = [schoolId, hours];
  const [totals, topPaths, timeline] = await Promise.all([
    pool.query<LogTotals>(
      `SELECT COUNT(*) FILTER (WHERE level = 'error')::int AS errors,
              COUNT(*) FILTER (WHERE level = 'warn')::int AS warnings,
              COUNT(*) FILTER (WHERE duration_ms >= $3)::int AS slow,
              COUNT(*) FILTER (WHERE source = 'web')::int AS "webErrors"
       FROM api_logs WHERE ${IN_SCOPE}`,
      [...params, SLOW_REQUEST_MS],
    ),
    pool.query<TopPath>(
      `SELECT method, path, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE level = 'error')::int AS errors,
              mode() WITHIN GROUP (ORDER BY status) AS "commonStatus"
       FROM api_logs WHERE ${IN_SCOPE} AND source = 'api'
       GROUP BY method, path
       ORDER BY count DESC
       LIMIT 5`,
      params,
    ),
    // Every bucket, including the empty ones, so a chart has no gaps
    pool.query<TimelineBucket>(
      `WITH buckets AS (
         SELECT generate_series(
           date_trunc($3, now()) - make_interval(hours => $2) + CASE WHEN $3 = 'hour' THEN interval '1 hour' ELSE interval '1 day' END,
           date_trunc($3, now()),
           CASE WHEN $3 = 'hour' THEN interval '1 hour' ELSE interval '1 day' END) AS bucket
       )
       SELECT b.bucket AS "start",
              COUNT(l.id) FILTER (WHERE l.level = 'error')::int AS errors,
              COUNT(l.id) FILTER (WHERE l.level = 'warn')::int AS warnings
       FROM buckets b
       LEFT JOIN api_logs l ON date_trunc($3, l.created_at) = b.bucket
         AND ($1::uuid IS NULL OR l.school_id = $1::uuid)
       GROUP BY b.bucket
       ORDER BY b.bucket`,
      [...params, hours > 24 ? 'day' : 'hour'],
    ),
  ]);
  return { totals: totals.rows[0]!, topPaths: topPaths.rows, timeline: timeline.rows };
}

export const LOG_PAGE_SIZE = 50;

interface LogFilter {
  schoolId: string | null;
  level: LogLevel | null;
  source: LogSource | null;
  // Entries older than this id: the next page
  before: string | null;
  // Stack traces and the like, for super admins only
  withDetail: boolean;
}

export async function listLogs(filter: LogFilter) {
  const { rows } = await pool.query<LogRow>(
    `SELECT l.id::text, l.created_at AS "createdAt", l.level, l.source, l.method, l.path, l.status,
            l.duration_ms AS "durationMs", l.message, l.code,
            CASE WHEN $5::boolean THEN l.detail END AS detail,
            CASE WHEN u.id IS NULL THEN NULL
                 ELSE json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name, 'email', u.email) END AS "user"
     FROM api_logs l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE ($1::uuid IS NULL OR l.school_id = $1::uuid)
       AND ($2::text IS NULL OR l.level = $2)
       AND ($3::text IS NULL OR l.source = $3)
       AND ($4::bigint IS NULL OR l.id < $4::bigint)
     ORDER BY l.id DESC
     LIMIT ${LOG_PAGE_SIZE}`,
    [filter.schoolId, filter.level, filter.source, filter.before, filter.withDetail],
  );
  return rows;
}
