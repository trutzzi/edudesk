import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

vi.mock('./db/pool.js', () => ({ pool: { query: vi.fn().mockResolvedValue({ rows: [] }), connect: vi.fn() } }));

const app = createApp();

describe('createApp', () => {
  it('answers unknown routes with a JSON 404 and no X-Powered-By header', async () => {
    const res = await request(app).get('/api/nothing-here');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Not found' });
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('protects school routes behind sign-in', async () => {
    expect((await request(app).get('/api/classes')).status).toBe(401);
  });
});
