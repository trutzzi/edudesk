import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../db.js';
import { errorHandler } from '../middleware/errors.js';
import { generateToken } from '../utils/auth.js';
import { recordLog } from '../utils/logs.js';
import monitoringRoutes from './monitoring.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));
vi.mock('../utils/logs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/logs.js')>()),
  recordLog: vi.fn(),
}));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use(express.json()).use('/api/monitoring', monitoringRoutes).use(errorHandler);

const auth = (role = 'school_admin', schoolId: string | null = 's1') =>
  `Bearer ${generateToken({ id: 'u1', email: 'a@school.ro', role, school_id: schoolId })}`;

beforeEach(() => {
  query.mockReset();
  vi.mocked(recordLog).mockReset();
});

describe('POST /api/monitoring/client-errors', () => {
  it('records a browser error by page, without the query string', async () => {
    const res = await request(app)
      .post('/api/monitoring/client-errors')
      .set('Authorization', auth('teacher'))
      .send({ message: 'TypeError: x is undefined', stack: 'at Grid', url: 'http://localhost:3000/dashboard/classes/4f56eb0f-e710-4d30-bced-559ed7d54cdb?token=x' });

    expect(res.status).toBe(204);
    expect(recordLog).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', source: 'web', path: '/dashboard/classes/:id', userId: 'u1', schoolId: 's1' })
    );
  });

  it('accepts anonymous reports', async () => {
    const res = await request(app)
      .post('/api/monitoring/client-errors')
      .send({ message: 'boom', url: 'http://localhost:3000/login' });

    expect(res.status).toBe(204);
    expect(recordLog).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it('rejects reports without a message or a real url', async () => {
    expect((await request(app).post('/api/monitoring/client-errors').send({ url: 'http://x.ro/' })).status).toBe(400);
    expect((await request(app).post('/api/monitoring/client-errors').send({ message: 'x', url: 'nope' })).status).toBe(400);
  });
});

describe('GET /api/monitoring/summary', () => {
  it("summarises the admin's school over the last day", async () => {
    query.mockResolvedValue({ rows: [{ errors: 1, warnings: 2 }] });

    const res = await request(app).get('/api/monitoring/summary').set('Authorization', auth());

    expect(res.status).toBe(200);
    expect(res.body.rangeHours).toBe(24);
    expect(res.body.server).toEqual(expect.objectContaining({ uptimeSeconds: expect.any(Number) }));
    // Every query after the database ping is limited to the school
    for (const call of query.mock.calls.slice(1)) expect(call[1]?.[0]).toBe('s1');
  });

  it('rejects unknown ranges', async () => {
    expect((await request(app).get('/api/monitoring/summary?range=1y').set('Authorization', auth())).status).toBe(400);
  });

  it('is only for admins', async () => {
    expect((await request(app).get('/api/monitoring/summary').set('Authorization', auth('teacher'))).status).toBe(403);
  });
});

describe('GET /api/monitoring/logs', () => {
  it('hides internal detail from school admins', async () => {
    query.mockResolvedValue({ rows: [] });

    await request(app).get('/api/monitoring/logs?level=error').set('Authorization', auth());

    expect(query.mock.calls[0]?.[1]).toEqual(['s1', 'error', null, null, false]);
  });

  it('shows super admins every school, with detail', async () => {
    query.mockResolvedValue({ rows: [] });

    await request(app).get('/api/monitoring/logs?before=120').set('Authorization', auth('super_admin', null));

    expect(query.mock.calls[0]?.[1]).toEqual([null, null, null, '120', true]);
  });

  it('pages 50 entries at a time', async () => {
    query.mockResolvedValue({ rows: Array.from({ length: 50 }, (_, i) => ({ id: String(i) })) });

    const res = await request(app).get('/api/monitoring/logs').set('Authorization', auth());

    expect(res.body.hasMore).toBe(true);
  });

  it('rejects bad filters', async () => {
    expect((await request(app).get('/api/monitoring/logs?level=info').set('Authorization', auth())).status).toBe(400);
    expect((await request(app).get('/api/monitoring/logs?before=abc').set('Authorization', auth())).status).toBe(400);
  });
});
