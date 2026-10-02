import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { pool } from '../db.js';
import { generateToken } from '../utils/auth.js';
import { errorHandler } from '../middleware/errors.js';
import dashboardRoutes from './dashboards.js';

vi.mock('../db.js', () => ({ pool: { query: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;

const app = express().use('/api/dashboard', dashboardRoutes).use(errorHandler);

const tokenFor = (schoolId: string | null, role = 'school_admin') =>
  generateToken({ id: 'u1', email: 'ana@school.edu', role, school_id: schoolId });

beforeEach(() => {
  query.mockReset();
});

describe('GET /api/dashboard/stats', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.status).toBe(401);
  });

  it('returns the counts for the user school', async () => {
    query.mockResolvedValue({ rows: [{ studentsCount: 120, teachersCount: 8, adminsCount: 2, classesCount: 5 }] });

    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${tokenFor('s1')}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ studentsCount: 120, teachersCount: 8, adminsCount: 2, classesCount: 5 });
    expect(query.mock.calls[0]?.[1]).toEqual(['s1']);
  });

  it('gives super admins the totals of every school', async () => {
    query.mockResolvedValue({ rows: [{ studentsCount: 0, teachersCount: 0, adminsCount: 0 }] });

    await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${tokenFor(null, 'super_admin')}`);

    expect(query.mock.calls[0]?.[1]).toEqual([null]);
  });

  it('is only for admins', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${tokenFor('s1', 'teacher')}`);

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses other users without a school instead of showing every school', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${tokenFor(null)}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('NO_SCHOOL');
    expect(query).not.toHaveBeenCalled();
  });
});
