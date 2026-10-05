import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import healthRoutes from './health.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), totalCount: 1, idleCount: 1, waitingCount: 0 } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;
const app = express().use('/api/health', healthRoutes);

beforeEach(() => {
  query.mockReset();
});

describe('health routes', () => {
  it('says the process is up', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('reports a reachable database', async () => {
    query.mockResolvedValue({ rows: [{ database: 'edu_desk', version: 'PostgreSQL 16' }] });

    const res = await request(app).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.checks.database).toMatchObject({ status: 'up', database: 'edu_desk' });
  });

  it('answers 503 when the database is down', async () => {
    query.mockRejectedValue(Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' }));

    const res = await request(app).get('/api/health/db');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'down', error: 'ECONNREFUSED' });
  });
});
