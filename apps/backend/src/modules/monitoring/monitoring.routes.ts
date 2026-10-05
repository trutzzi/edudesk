import express from 'express';
import { authenticateJWT, currentUser, optionalJWT, requireRole, schoolIdOf, type AuthenticatedRequest } from '../../http/auth.js';
import { HttpError } from '../../http/errors.js';
import { readBody } from '../../http/query.js';
import { normalizePath } from '../../lib/paths.js';
import { isNonEmptyString } from '../../lib/validation.js';
import { listLogs, LOG_PAGE_SIZE, pingDatabase, recordLog, summarizeLogs, type LogLevel, type LogSource } from './logs.repository.js';

const router = express.Router();

// POST /api/monitoring/client-errors: { message, stack?, url } from the web app's error reporter.
// Signed in or not: errors on the sign-in page matter too.
router.post('/client-errors', optionalJWT, async (req: AuthenticatedRequest, res) => {
  const { message, stack, url } = readBody(req);
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

// For admins: school admins see their school's entries, super admins everyone's
const admin = express.Router();
admin.use(authenticateJWT, requireRole('school_admin', 'super_admin'));

const isSuperAdmin = (req: AuthenticatedRequest) => currentUser(req).role === 'super_admin';
const scopeOf = (req: AuthenticatedRequest) => (isSuperAdmin(req) ? null : schoolIdOf(req));

const RANGE_HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7 };
const LEVELS: LogLevel[] = ['error', 'warn'];
const SOURCES: LogSource[] = ['api', 'web'];

// GET /api/monitoring/summary?range=24h|7d
admin.get('/summary', async (req: AuthenticatedRequest, res) => {
  const range: unknown = req.query.range ?? '24h';
  const hours = typeof range === 'string' ? RANGE_HOURS[range] : undefined;
  if (!hours) throw new HttpError(400, 'range must be 24h or 7d');
  const scope = scopeOf(req);

  const dbLatencyMs = await pingDatabase();
  const summary = await summarizeLogs(scope, hours);
  res.json({
    generatedAt: new Date().toISOString(),
    rangeHours: hours,
    ...summary,
    server: {
      uptimeSeconds: Math.round(process.uptime()),
      dbLatencyMs: Math.round(dbLatencyMs * 10) / 10,
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
});

// GET /api/monitoring/logs?level=error|warn&source=api|web&before=<id>: newest first, a page at a time
admin.get('/logs', async (req: AuthenticatedRequest, res) => {
  const { level, source, before } = req.query;
  if ((level !== undefined && !LEVELS.includes(level as LogLevel)) || (source !== undefined && !SOURCES.includes(source as LogSource))) {
    throw new HttpError(400, 'level must be error or warn, and source api or web');
  }
  if (before !== undefined && !(typeof before === 'string' && /^\d+$/.test(before))) throw new HttpError(400, 'before must be an entry id');

  const entries = await listLogs({
    schoolId: scopeOf(req),
    level: (level as LogLevel | undefined) ?? null,
    source: (source as LogSource | undefined) ?? null,
    before: before ?? null,
    withDetail: isSuperAdmin(req),
  });
  res.json({ entries, hasMore: entries.length === LOG_PAGE_SIZE });
});

router.use(admin);

export default router;
