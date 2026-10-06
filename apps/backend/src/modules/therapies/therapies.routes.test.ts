import express from 'express';
import { DatabaseError } from 'pg';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../../db/pool.js';
import { errorHandler } from '../../http/errors.js';
import { generateToken } from '../../lib/session.js';
import therapyRoutes from './therapies.routes.js';

vi.mock('../../db/pool.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const query = vi.mocked(pool.query) as unknown as ReturnType<typeof vi.fn>;
const client = { query: vi.fn(), release: vi.fn() };
vi.mocked(pool.connect).mockImplementation(async () => client as never);

const app = express().use(express.json()).use('/api/therapies', therapyRoutes).use(errorHandler);
const auth = (role = 'school_admin') => `Bearer ${generateToken({ id: 'u1', email: null, role, school_id: 's1' })}`;

const THERAPY_ID = '984ac996-fabf-4ac7-82ab-1eaeb52dd75c';
const duplicate = () => Object.assign(new DatabaseError('dup', 0, 'error'), { code: '23505' });
const statements = () => client.query.mock.calls.map(([sql]) => String(sql).trim().split(/\s+/).slice(0, 2).join(' '));

// The locked therapy is Kineto, and `courses` courses run it
function withTherapy(courses = 0) {
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FOR UPDATE')) return { rows: [{ name: 'Kineto' }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ count: courses }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  query.mockReset();
  client.query.mockReset();
});

describe('therapies', () => {
  it("lists the institution's therapies for therapists too", async () => {
    query.mockResolvedValue({ rows: [{ id: THERAPY_ID, name: 'Kineto', coursesCount: 2, therapistsCount: 1 }] });

    const res = await request(app).get('/api/therapies').set('Authorization', auth('teacher'));

    expect(res.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1']);
  });

  it('adds one', async () => {
    query.mockResolvedValue({ rows: [{ id: THERAPY_ID, name: 'Meloterapie' }] });

    const res = await request(app).post('/api/therapies').set('Authorization', auth()).send({ name: '  Meloterapie ' });

    expect(res.status).toBe(201);
    expect(query.mock.calls[0]?.[1]).toEqual(['s1', 'Meloterapie']);
  });

  it('refuses a name the institution already has', async () => {
    query.mockRejectedValue(duplicate());

    const res = await request(app).post('/api/therapies').set('Authorization', auth()).send({ name: 'Kineto' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('THERAPY_EXISTS');
  });

  it('renames it and the courses that run it', async () => {
    withTherapy();

    const res = await request(app).patch(`/api/therapies/${THERAPY_ID}`).set('Authorization', auth()).send({ name: 'Kinetoterapie' });

    expect(res.status).toBe(200);
    const renameCourses = client.query.mock.calls.find(([sql]) => String(sql).includes('UPDATE courses'));
    expect(renameCourses?.[1]).toEqual(['s1', 'Kineto', 'Kinetoterapie']);
  });

  it("won't delete a therapy that courses still run", async () => {
    withTherapy(3);

    const res = await request(app).delete(`/api/therapies/${THERAPY_ID}`).set('Authorization', auth());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('THERAPY_IN_USE');
    expect(statements()).not.toContain('DELETE FROM');
  });

  it('deletes an unused one', async () => {
    withTherapy(0);

    expect((await request(app).delete(`/api/therapies/${THERAPY_ID}`).set('Authorization', auth())).status).toBe(204);
    expect(statements()).toContain('DELETE FROM');
  });

  it("returns 404 for another institution's therapy", async () => {
    client.query.mockResolvedValue({ rows: [] });

    expect((await request(app).delete(`/api/therapies/${THERAPY_ID}`).set('Authorization', auth())).status).toBe(404);
  });

  it('only lets admins change the list', async () => {
    expect((await request(app).post('/api/therapies').set('Authorization', auth('teacher')).send({ name: 'X' })).status).toBe(403);
  });
});
