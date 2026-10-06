import { describe, expect, it } from 'vitest';
import { generatePassword, PASSWORD_ALPHABET } from './generatePassword.js';

describe('generatePassword', () => {
  it('uses only easy-to-read letters and digits', () => {
    const password = generatePassword(200);

    expect(password).toHaveLength(200);
    expect([...password].every((char) => PASSWORD_ALPHABET.includes(char))).toBe(true);
    expect(password).not.toMatch(/[01ilo]/);
  });
});
