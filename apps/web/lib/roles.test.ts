import { describe, expect, it } from 'vitest';
import { homeFor, isAdmin } from './roles';

describe('roles', () => {
  it('sends admins to the overview and everyone else to their timetable', () => {
    expect(homeFor('school_admin')).toBe('/dashboard');
    expect(homeFor('super_admin')).toBe('/dashboard');
    expect(homeFor('teacher')).toBe('/dashboard/timetable');
    expect(homeFor('parent')).toBe('/dashboard/timetable');
  });

  it('knows who is an admin', () => {
    expect(isAdmin('school_admin')).toBe(true);
    expect(isAdmin('student')).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
