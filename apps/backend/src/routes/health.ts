import express, { type Request, type Response } from 'express';
import { pool } from '../db.js';

const router = express.Router();

const DB_TIMEOUT_MS = 3000;

// Fails instead of hanging when the database is unreachable
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
  ]);

// Connection failures (e.g. ECONNREFUSED) arrive as an AggregateError with an empty message
const describeError = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  const code = (err as NodeJS.ErrnoException).code;
  return err.message || code || err.name;
};

const checkDatabase = async () => {
  const start = Date.now();
  try {
    const result = await withTimeout(
      pool.query('SELECT current_database() AS database, version() AS version'),
      DB_TIMEOUT_MS
    );
    const migrations = await withTimeout(
      pool.query('SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 1'),
      DB_TIMEOUT_MS
    ).catch(() => null);

    return {
      status: 'up' as const,
      latencyMs: Date.now() - start,
      database: result.rows[0]?.database,
      version: result.rows[0]?.version,
      latestMigration: migrations?.rows[0] ?? null,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch (err) {
    return {
      status: 'down' as const,
      latencyMs: Date.now() - start,
      error: describeError(err),
    };
  }
};

// GET /api/health — liveness: is the process up
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// GET /api/health/db — database connectivity and details
router.get('/db', async (req: Request, res: Response): Promise<any> => {
  const db = await checkDatabase();
  return res.status(db.status === 'up' ? 200 : 503).json(db);
});

// GET /api/health/ready — readiness: process and all dependencies
router.get('/ready', async (req: Request, res: Response): Promise<any> => {
  const db = await checkDatabase();
  const ready = db.status === 'up';
  const memory = process.memoryUsage();

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    environment: process.env.NODE_ENV ?? 'development',
    memoryMb: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
    },
    checks: { database: db },
  });
});

export default router;
