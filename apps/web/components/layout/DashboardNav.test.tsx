import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/features/auth/AuthProvider';
import { renderWithIntl } from '@/test/renderWithIntl';
import { DashboardNav } from './DashboardNav';

const pathname = vi.hoisted(() => ({ current: '/dashboard' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const labels = (role: Role) => {
  renderWithIntl(<DashboardNav role={role} />);
  return screen.getAllByRole('link').map((link) => link.textContent);
};

beforeEach(() => {
  pathname.current = '/dashboard';
});

describe('DashboardNav', () => {
  it.each([
    ['school_admin', ['Overview', 'Timeline', 'Classes', 'People', 'Calendar']],
    ['super_admin', ['Overview']],
    ['teacher', ['My timetable', 'My students', 'Calendar']],
    ['student', ['My timetable', 'Calendar']],
    ['parent', ['My timetable', 'Calendar']],
  ] as const)('shows %s only their own sections', (role, expected) => {
    expect(labels(role)).toEqual(expected);
  });

  it('marks the current section, and a class page counts as Classes', () => {
    pathname.current = '/dashboard/classes/c1';
    renderWithIntl(<DashboardNav role="school_admin" />);

    expect(screen.getByRole('link', { name: 'Classes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('marks the overview only on its own page', () => {
    renderWithIntl(<DashboardNav role="school_admin" />);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });
});
