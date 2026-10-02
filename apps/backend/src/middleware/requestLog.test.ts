import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { recordLog } from '../utils/logs.js';
import { errorHandler } from './errors.js';
import { requestLogger } from './requestLog.js';

vi.mock('../utils/logs.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/logs.js')>()),
  recordLog: vi.fn(),
}));

const app = express()
  .use(requestLogger)
  .get('/ok', (_req, res) => {
    res.json({ fine: true });
  })
  .get('/classes/:id', (_req, res) => {
    res.status(404).json({ message: 'Class not found', code: 'NOT_FOUND' });
  })
  .get('/boom', () => {
    throw new Error('database is on fire');
  })
  .use(errorHandler);

// The log is written once the response has finished
const logged = () => vi.waitFor(() => expect(recordLog).toHaveBeenCalled()).then(() => vi.mocked(recordLog).mock.calls[0]![0]);

beforeEach(() => {
  vi.mocked(recordLog).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('requestLogger', () => {
  it('ignores requests that went fine', async () => {
    await request(app).get('/ok');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(recordLog).not.toHaveBeenCalled();
  });

  it('logs a failed request as a warning, with the route and what the client was told', async () => {
    await request(app).get('/classes/4f56eb0f-e710-4d30-bced-559ed7d54cdb?token=secret');

    expect(await logged()).toMatchObject({
      level: 'warn',
      source: 'api',
      method: 'GET',
      path: '/classes/:id',
      status: 404,
      message: 'Class not found',
      code: 'NOT_FOUND',
    });
  });

  it('logs a crash as an error with its stack, while the client only gets a generic message', async () => {
    const res = await request(app).get('/boom');

    expect(res.body).toEqual({ message: 'Internal server error' });
    const entry = await logged();
    expect(entry).toMatchObject({ level: 'error', status: 500, message: 'Internal server error' });
    expect(entry.detail).toContain('database is on fire');
  });
});
