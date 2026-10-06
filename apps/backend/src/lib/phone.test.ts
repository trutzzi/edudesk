import { describe, expect, it } from 'vitest';
import { normalizePhone } from './phone.js';

describe('normalizePhone', () => {
  it.each([
    ['0722 123 456', '+40722123456'],
    ['0722-123-456', '+40722123456'],
    ['+40 (722) 123.456', '+40722123456'],
    ['0040722123456', '+40722123456'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('reads %s as %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'call me', '0722', '+0722123456', 12345])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
