import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { authenticateJWT, requireRole, requireSchool, type AuthenticatedRequest } from './auth.js';
import { generateToken } from '../utils/auth.js';

const mockResponse = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
};

const requestWith = (authorization?: string) => ({ headers: { authorization } }) as AuthenticatedRequest;

describe('authenticateJWT', () => {
  it('returns 401 when the header is missing', () => {
    const res = mockResponse();
    const next = vi.fn();

    authenticateJWT(requestWith(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is invalid', () => {
    const res = mockResponse();
    const next = vi.fn();

    authenticateJWT(requestWith('Bearer not-a-token'), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the user and calls next for a valid token', () => {
    const token = generateToken({ id: 'u1', email: 'ana@school.edu', role: 'teacher', school_id: null });
    const req = requestWith(`Bearer ${token}`);
    const res = mockResponse();
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ id: 'u1', role: 'teacher', schoolId: null });
  });
});

const requestAs = (role: string, schoolId: string | null = 's1') =>
  ({ user: { id: 'u1', email: 'ana@school.edu', role, schoolId } }) as AuthenticatedRequest;

describe('requireRole', () => {
  it('lets a listed role through', () => {
    const next = vi.fn();

    requireRole('teacher', 'school_admin')(requestAs('teacher'), mockResponse(), next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for other roles', () => {
    const res = mockResponse();
    const next = vi.fn();

    requireRole('school_admin')(requestAs('student'), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireSchool', () => {
  it('returns 403 when the user has no school', () => {
    const res = mockResponse();
    const next = vi.fn();

    requireSchool(requestAs('school_admin', null), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
