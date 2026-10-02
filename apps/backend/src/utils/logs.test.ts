import { describe, expect, it } from 'vitest';
import { normalizePath } from './logs.js';

describe('normalizePath', () => {
  it('groups ids and drops the query string', () => {
    expect(normalizePath('/api/classes/4f56eb0f-e710-4d30-bced-559ed7d54cdb/students/D563B3C9-04B6-4EFA-8D5B-7339416C286E')).toBe(
      '/api/classes/:id/students/:id'
    );
    expect(normalizePath('/api/invitations/lookup?token=secret')).toBe('/api/invitations/lookup');
  });
});
