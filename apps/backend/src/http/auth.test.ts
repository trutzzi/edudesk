import type { NextFunction, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { generateToken } from '../lib/session.js';
import { authenticateJWT, optionalJWT, requireRole, requireSchool, schoolIdOf, type AuthenticatedRequest } from './auth.js';
import { HttpError } from './errors.js';

const res = {} as Response;
const requestWith = (authorization?: string) => ({ headers: { authorization } }) as AuthenticatedRequest;
const requestAs = (role: string, schoolId: string | null = 's1') =>
  ({ user: { id: 'u1', email: 'ana@school.edu', role, schoolId } }) as AuthenticatedRequest;
const token = (schoolId: string | null = null) =>
  generateToken({ id: 'u1', email: 'ana@school.edu', role: 'teacher', school_id: schoolId });

// The error a middleware passed to next(), if any
const passedError = (next: NextFunction) => vi.mocked(next).mock.calls[0]?.[0] as HttpError | undefined;

describe('authenticateJWT', () => {
  it.each([
    ['the header is missing', undefined],
    ['the token is invalid', 'Bearer not-a-token'],
  ])('rejects with 401 when %s', (_case, header) => {
    const next = vi.fn();

    authenticateJWT(requestWith(header), res, next);

    expect(passedError(next)).toMatchObject({ status: 401 });
  });

  it('attaches the user for a valid token', () => {
    const req = requestWith(`Bearer ${token()}`);
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: 'u1', role: 'teacher' });
  });
});

describe('optionalJWT', () => {
  it('lets anonymous requests through without a user', () => {
    const req = requestWith('Bearer not-a-token');
    const next = vi.fn();

    optionalJWT(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  it('lets a listed role through', () => {
    const next = vi.fn();

    requireRole('teacher', 'school_admin')(requestAs('teacher'), res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects other roles with 403', () => {
    const next = vi.fn();

    requireRole('school_admin')(requestAs('student'), res, next);

    expect(passedError(next)).toMatchObject({ status: 403 });
  });
});

describe('requireSchool', () => {
  it('rejects users without a school with 403', () => {
    const next = vi.fn();

    requireSchool(requestAs('school_admin', null), res, next);

    expect(passedError(next)).toMatchObject({ status: 403, code: 'NO_SCHOOL' });
  });
});

describe('schoolIdOf', () => {
  it("returns the user's school, or throws when there is none", () => {
    expect(schoolIdOf(requestAs('teacher', 's1'))).toBe('s1');
    expect(() => schoolIdOf(requestAs('teacher', null))).toThrow(HttpError);
  });
});
