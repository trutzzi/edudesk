import { randomInt } from 'node:crypto';

// Lowercase letters and digits without the ones people misread when it's read out or written down: 0/o, 1/l/i
export const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const generatePassword = (length: number) =>
  Array.from({ length }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join('');
