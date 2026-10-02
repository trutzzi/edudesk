import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { comparePassword, generateToken, getJwtSecret, hashPassword } from './auth.js';

describe('password hashing', () => {
  it('hashes a password and verifies it', async () => {
    const hash = await hashPassword('password123');

    expect(hash).not.toBe('password123');
    expect(await comparePassword('password123', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('password123');

    expect(await comparePassword('wrong-password', hash)).toBe(false);
  });
});

describe('generateToken', () => {
  it('signs the user id, email, role and school id', () => {
    const token = generateToken({ id: 'u1', email: 'ana@school.edu', role: 'teacher', school_id: 's1' });
    const payload = jwt.verify(token, 'test-secret') as jwt.JwtPayload;

    expect(payload).toMatchObject({ id: 'u1', email: 'ana@school.edu', role: 'teacher', schoolId: 's1' });
  });
});

describe('getJwtSecret', () => {
  it('returns the secret from the environment', () => {
    expect(getJwtSecret()).toBe('test-secret');
  });

  it('throws when the secret is missing', () => {
    vi.stubEnv('JWT_SECRET', '');

    expect(() => getJwtSecret()).toThrow('JWT_SECRET is not set');

    vi.unstubAllEnvs();
  });
});
