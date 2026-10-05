import { describe, expect, it } from 'vitest';
import { generateToken, toSession, verifyToken } from './session.js';

describe('session tokens', () => {
  it('signs the user id, email, role and school id, and reads them back', () => {
    const token = generateToken({ id: 'u1', email: 'ana@school.edu', role: 'teacher', school_id: 's1' });

    expect(verifyToken(token)).toMatchObject({ id: 'u1', email: 'ana@school.edu', role: 'teacher', schoolId: 's1' });
  });

  it('rejects a token that was tampered with', () => {
    const token = generateToken({ id: 'u1', email: 'ana@school.edu', role: 'teacher', school_id: 's1' });

    expect(() => verifyToken(`${token}x`)).toThrow();
  });
});

describe('toSession', () => {
  it('returns a token and the user in the shape the web app stores', () => {
    const session = toSession({ id: 'u1', email: 'a@b.ro', first_name: 'Ana', last_name: 'Pop', role: 'teacher', school_id: null });

    expect(session.user).toEqual({ id: 'u1', email: 'a@b.ro', firstName: 'Ana', lastName: 'Pop', role: 'teacher', schoolId: null });
    expect(session.token).toEqual(expect.any(String));
  });
});
