import { pool } from '../../db/pool.js';

const DB_TIMEOUT_MS = 3000;

// Fails instead of hanging when the database is unreachable
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Connection failures (e.g. ECONNREFUSED) arrive as an AggregateError with an empty message
const describeError = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  return err.message || (err as NodeJS.ErrnoException).code || err.name;
};

export async function checkDatabase() {
  const start = Date.now();
  try {
    const result = await withTimeout(
      pool.query<{ database: string; version: string }>('SELECT current_database() AS database, version() AS version'),
      DB_TIMEOUT_MS,
    );
    const migrations = await withTimeout(
      pool.query<{ name: string; run_on: Date }>('SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 1'),
      DB_TIMEOUT_MS,
    ).catch(() => null);

    return {
      status: 'up' as const,
      latencyMs: Date.now() - start,
      database: result.rows[0]?.database,
      version: result.rows[0]?.version,
      latestMigration: migrations?.rows[0] ?? null,
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    };
  } catch (err) {
    return { status: 'down' as const, latencyMs: Date.now() - start, error: describeError(err) };
  }
}
