import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from './password.js';

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
