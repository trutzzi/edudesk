import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { emailLimiter } from './rateLimit.js';

describe('rate limiting', () => {
  it('answers 429 once an IP goes over the limit', async () => {
    const app = express()
      .use(emailLimiter)
      .post('/', (_req, res) => {
        res.json({ ok: true });
      });

    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await request(app).post('/')).status);

    expect(statuses).toEqual([200, 200, 200, 429]);
    const blocked = await request(app).post('/');
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
