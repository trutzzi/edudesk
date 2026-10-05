import express, { type Request, type Response } from 'express';
import { env } from '../../config/env.js';
import { checkDatabase } from './databaseCheck.js';

const router = express.Router();

const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024);

// GET /api/health: liveness, is the process up
router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date(), uptimeSeconds: Math.round(process.uptime()) });
});

// GET /api/health/db: database connectivity and details
router.get('/db', async (_req: Request, res: Response) => {
  const db = await checkDatabase();
  res.status(db.status === 'up' ? 200 : 503).json(db);
});

// GET /api/health/ready: readiness, the process and everything it depends on
router.get('/ready', async (_req: Request, res: Response) => {
  const db = await checkDatabase();
  const ready = db.status === 'up';
  const memory = process.memoryUsage();

  res.status(ready ? 200 : 503).json({
    status: ready ? 'OK' : 'DEGRADED',
    timestamp: new Date(),
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    environment: env.nodeEnv,
    memoryMb: { rss: toMb(memory.rss), heapUsed: toMb(memory.heapUsed) },
    checks: { database: db },
  });
});

export default router;
