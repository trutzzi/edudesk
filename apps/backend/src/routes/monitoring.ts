import express from 'express';
import { pool } from '../db.js';
import { authenticateJWT, optionalJWT, requireRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { normalizePath, recordLog, SLOW_REQUEST_MS } from '../utils/logs.js';
import { isNonEmptyString } from '../utils/validation.js';

const router = express.Router();

// POST /api/monitoring/client-errors — { message, stack?, url } from the web app's error reporter.
// Signed in or not: errors on the sign-in page matter too.
router.post('/client-errors', optionalJWT, async (req: AuthenticatedRequest, res) => {
  const { message, stack, url } = req.body ?? {};
  if (!isNonEmptyString(message) || !isNonEmptyString(url)) throw new HttpError(400, 'message and url are required');

  let pagePath: string;
  try {
    pagePath = normalizePath(new URL(url).pathname);
  } catch {
    throw new HttpError(400, 'url must be a full URL');
  }

  await recordLog({
    level: 'error',
    source: 'web',
    path: pagePath,
    message,
    detail: typeof stack === 'string' ? stack : undefined,
    userId: req.user?.id,
    schoolId: req.user?.schoolId,
  });
  res.status(204).end();
});

// Everything below is for admins: school admins see their school's entries, super admins everyone's
const admin = express.Router();
admin.use(authenticateJWT, requireRole('school_admin', 'super_admin'));

// The school to limit entries to, or null for a super admin
const scopeOf = (req: AuthenticatedRequest) => {
  if (req.user!.role === 'super_admin') return null;
  if (!req.user!.schoolId) throw new HttpError(403, 'Your account is not linked to a school', 'NO_SCHOOL');
  return req.user!.schoolId;
};

const RANGES: Record<string, number> = { '24h': 24, '7d': 24 * 7 };

// GET /api/monitoring/summary?range=24h|7d
admin.get('/summary', async (req: AuthenticatedRequest, res) => {
  const hours = RANGES[String(req.query.range ?? '24h')];
  if (!hours) throw new HttpError(400, 'range must be 24h or 7d');
  const params = [scopeOf(req), hours];
  const inScope = `($1::uuid IS NULL OR school_id = $1::uuid) AND created_at > now() - make_interval(hours => $2)`;

  const pingStarted = process.hrtime.bigint();
  await pool.query('SELECT 1');
  const dbLatencyMs = Number(process.hrtime.bigint() - pingStarted) / 1_000_000;

  const [totals, topPaths, timeline] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE level = 'error')::int AS errors,
              COUNT(*) FILTER (WHERE level = 'warn')::int AS warnings,
              COUNT(*) FILTER (WHERE duration_ms >= $3)::int AS slow,
              COUNT(*) FILTER (WHERE source = 'web')::int AS "webErrors"
       FROM api_logs WHERE ${inScope}`,
      [...params, SLOW_REQUEST_MS]
    ),
    pool.query(
      `SELECT method, path, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE level = 'error')::int AS errors,
              mode() WITHIN GROUP (ORDER BY status) AS "commonStatus"
       FROM api_logs WHERE ${inScope} AND source = 'api'
       GROUP BY method, path
       ORDER BY count DESC
       LIMIT 5`,
      params
    ),
    // One row per hour (24h) or per day (7d), including the empty ones, so a chart has no gaps
    pool.query(
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
      [...params, hours > 24 ? 'day' : 'hour']
    ),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    rangeHours: hours,
    totals: totals.rows[0],
    topPaths: topPaths.rows,
    timeline: timeline.rows,
    server: {
      uptimeSeconds: Math.round(process.uptime()),
      dbLatencyMs: Math.round(dbLatencyMs * 10) / 10,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
});

const LEVELS = new Set(['error', 'warn']);
const SOURCES = new Set(['api', 'web']);
const PAGE_SIZE = 50;

// GET /api/monitoring/logs?level=error|warn&source=api|web&before=<id> — newest first, 50 at a time
admin.get('/logs', async (req: AuthenticatedRequest, res) => {
  const { level, source, before } = req.query;
  if ((level !== undefined && !LEVELS.has(String(level))) || (source !== undefined && !SOURCES.has(String(source)))) {
    throw new HttpError(400, 'level must be error or warn, and source api or web');
  }
  if (before !== undefined && !/^\d+$/.test(String(before))) throw new HttpError(400, 'before must be an entry id');

  const isSuperAdmin = req.user!.role === 'super_admin';
  const { rows } = await pool.query(
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
     LIMIT ${PAGE_SIZE}`,
    [scopeOf(req), level ?? null, source ?? null, before ?? null, isSuperAdmin]
  );
  res.json({ entries: rows, hasMore: rows.length === PAGE_SIZE });
});

router.use(admin);

export default router;
