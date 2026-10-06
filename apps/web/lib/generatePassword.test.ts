import { describe, expect, it } from 'vitest';
import { generatePassword, PASSWORD_ALPHABET } from './generatePassword';

describe('generatePassword', () => {
  it('makes 6 easy characters', () => {
    const password = generatePassword();

    expect(password).toHaveLength(6);
    expect([...password].every((char) => PASSWORD_ALPHABET.includes(char))).toBe(true);
  });

  it('never uses look-alike characters', () => {
    expect(generatePassword(500)).not.toMatch(/[01ilo]/);
  });
});
