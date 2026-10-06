import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import brandingRoutes, { MAX_LOGO_BYTES } from './branding.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;
// Like the app: JSON bodies are parsed for every route, the logo route reads its own raw body
const app = express().use(express.json()).use('/api/schools', brandingRoutes).use(errorHandler);
const auth = (role = 'school_admin') => `Bearer ${generateToken({ id: 'u1', email: null, role, school_id: 's1' })}`;

const SCHOOL_ID = '4f56eb0f-e710-4d30-bced-559ed7d54cdb';
const branding = { appName: 'Centrul Blue', color: '#0ea5e9', logoUrl: null };
const updates = () => query.mock.calls.filter(([sql]) => String(sql).trim().startsWith('UPDATE'));

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [branding] });
});

describe('branding', () => {
  it("gives every member their institution's look", async () => {
    const res = await request(app).get('/api/schools/branding').set('Authorization', auth('student'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(branding);
  });

  it('lets the admin set the name and color, and reset them', async () => {
    const patch = (body: object) => request(app).patch('/api/schools/branding').set('Authorization', auth()).send(body);

    expect((await patch({ appName: ' Centrul Blue ', color: '#0EA5E9' })).status).toBe(200);
    expect(updates()[0]?.[1]).toEqual(['s1', true, 'Centrul Blue', true, '#0ea5e9']);

    expect((await patch({ appName: '', color: null })).status).toBe(200);
    expect(updates()[1]?.[1]).toEqual(['s1', true, null, true, null]);
  });

  it.each([
    ['a color that is not hex', { color: 'blue' }],
    ['a name that is too long', { appName: 'x'.repeat(61) }],
  ])('rejects %s', async (_case, body) => {
    expect((await request(app).patch('/api/schools/branding').set('Authorization', auth()).send(body)).status).toBe(400);
    expect(updates()).toHaveLength(0);
  });

  it('is changed only by admins', async () => {
    expect(
      (await request(app).patch('/api/schools/branding').set('Authorization', auth('teacher')).send({ color: '#000000' })).status,
    ).toBe(403);
  });
});

describe('logo', () => {
  const upload = (type: string, body: Buffer) =>
    request(app).put('/api/schools/branding/logo').set('Authorization', auth()).set('Content-Type', type).send(body);

  it('stores a PNG', async () => {
    const res = await upload('image/png', Buffer.from('png bytes'));

    expect(res.status).toBe(200);
    expect(updates()[0]?.[1]).toEqual(['s1', Buffer.from('png bytes'), 'image/png']);
  });

  it('refuses an SVG, which could carry scripts', async () => {
    const res = await upload('image/svg+xml', Buffer.from('<svg/>'));

    expect(res.status).toBe(400);
    expect(updates()).toHaveLength(0);
  });

  it('refuses an image over the limit', async () => {
    const res = await upload('image/png', Buffer.alloc(MAX_LOGO_BYTES + 1));

    expect(res.status).toBe(413);
    expect(res.body.code).toBe('TOO_LARGE');
  });

  it('serves the logo to anyone, cached', async () => {
    query.mockResolvedValue({ rows: [{ logo: Buffer.from('png bytes'), type: 'image/png' }] });

    const res = await request(app).get(`/api/schools/${SCHOOL_ID}/logo`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('returns 404 without a logo', async () => {
    query.mockResolvedValue({ rows: [] });

    expect((await request(app).get(`/api/schools/${SCHOOL_ID}/logo`)).status).toBe(404);
  });
});
