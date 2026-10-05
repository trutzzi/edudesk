import { describe, expect, it } from 'vitest';
import { HttpError } from './errors.js';
import { readDateRange, readId } from './query.js';

describe('readDateRange', () => {
  it('reads a valid range', () => {
    expect(readDateRange({ from: '2026-10-01', to: '2026-10-31' }, 31)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it.each([
    ['a missing date', { from: '2026-10-01' }],
    ['an impossible date', { from: '2026-02-30', to: '2026-03-01' }],
    ['a reversed range', { from: '2026-10-02', to: '2026-10-01' }],
    ['a range that is too long', { from: '2026-01-01', to: '2026-12-31' }],
  ])('rejects %s with 400', (_case, query) => {
    expect(() => readDateRange(query, 31)).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe('readId', () => {
  it('accepts a UUID and turns anything else into a 404', () => {
    expect(readId('4f56eb0f-e710-4d30-bced-559ed7d54cdb', 'Class not found')).toBe('4f56eb0f-e710-4d30-bced-559ed7d54cdb');
    expect(() => readId('nope', 'Class not found')).toThrow(new HttpError(404, 'Class not found'));
  });
});
