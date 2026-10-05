import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import eventRoutes from './events.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use(express.json()).use('/api/events', eventRoutes).use(errorHandler);

const EVENT_ID = 'ef7468ad-d23d-4e1b-bf1c-a3a272e70a96';
const CLASS_ID = '4f56eb0f-e710-4d30-bced-559ed7d54cdb';

const auth = (role = 'school_admin') => `Bearer ${generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: 's1' })}`;

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/events', () => {
  it("lets anyone in the school see its events and the country's public holidays, in date order", async () => {
    query.mockImplementation(async (sql: string) =>
      sql.includes('FROM public_holidays')
        ? {
            rows: [
              { id: 'holiday-RO-2026-12-01', title: 'Ziua Națională', startDate: '2026-12-01', endDate: '2026-12-01', national: true },
            ],
          }
        : { rows: [{ id: EVENT_ID, title: 'Vacanța de toamnă', startDate: '2026-10-24', endDate: '2026-11-01', national: false }] },
    );

    const res = await request(app).get('/api/events?from=2026-10-01&to=2026-12-31').set('Authorization', auth('student'));

    expect(res.status).toBe(200);
    expect(res.body.map((event: { title: string }) => event.title)).toEqual(['Vacanța de toamnă', 'Ziua Națională']);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', '2026-10-01', '2026-12-31']);
  });

  it('returns 400 without a valid range', async () => {
    const res = await request(app).get('/api/events?from=2026-10-01').set('Authorization', auth());

    expect(res.status).toBe(400);
  });
});

describe('POST /api/events', () => {
  const create = (body: object, role?: string) => request(app).post('/api/events').set('Authorization', auth(role)).send(body);

  it('creates a one-day event when there is no end date', async () => {
    query.mockResolvedValue({ rows: [{ id: EVENT_ID }] });

    const res = await create({ title: ' Teză ', kind: 'exam', startDate: '2026-10-14', classId: CLASS_ID });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', CLASS_ID, 'Teză', 'exam', '2026-10-14', '2026-10-14', 'u1']);
  });

  it.each([
    ['an unknown kind', { title: 'x', kind: 'party', startDate: '2026-10-14' }],
    ['a missing title', { kind: 'exam', startDate: '2026-10-14' }],
    ['an end before the start', { title: 'x', startDate: '2026-10-14', endDate: '2026-10-13' }],
  ])('returns 400 for %s', async (_case, body) => {
    expect((await create(body)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns 404 for a class of another school', async () => {
    query.mockResolvedValue({ rows: [] });

    expect((await create({ title: 'x', startDate: '2026-10-14', classId: CLASS_ID })).status).toBe(404);
  });

  it('is only for school admins', async () => {
    expect((await create({ title: 'x', startDate: '2026-10-14' }, 'teacher')).status).toBe(403);
  });
});

describe('DELETE /api/events/:id', () => {
  it('deletes the event', async () => {
    query.mockResolvedValue({ rowCount: 1 });

    const res = await request(app).delete(`/api/events/${EVENT_ID}`).set('Authorization', auth());

    expect(res.status).toBe(204);
  });

  it('returns 404 for an unknown or malformed id', async () => {
    query.mockResolvedValue({ rowCount: 0 });

    expect((await request(app).delete(`/api/events/${EVENT_ID}`).set('Authorization', auth())).status).toBe(404);
    expect((await request(app).delete('/api/events/nope').set('Authorization', auth())).status).toBe(404);
  });
});
