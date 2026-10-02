import { describe, expect, it } from 'vitest';
import { colorFor, distinctColors } from './colors';

describe('colors', () => {
  it('gives the same key the same color every time', () => {
    expect(colorFor('9A')).toBe(colorFor('9A'));
  });

  it('gives every key on screen its own color', () => {
    const colors = distinctColors(['English', 'Limba română', 'Matematică', 'English', 'Fizică']);
    expect(colors.size).toBe(4);
    expect(new Set([...colors.values()].map((c) => c.bar)).size).toBe(4);
  });
});
