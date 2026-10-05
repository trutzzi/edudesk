import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { signIn } from '@/test/signIn';
import { AdminOverview } from './AdminOverview';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const renderOverview = () =>
  render(
    <AuthProvider>
      <AdminOverview>
        <p>secret numbers</p>
      </AdminOverview>
    </AuthProvider>,
  );

afterEach(() => {
  replace.mockReset();
});

describe('AdminOverview', () => {
  it.each(['school_admin', 'super_admin'] as const)('shows its content to a %s', (role) => {
    signIn({ role });
    renderOverview();

    expect(screen.getByText('secret numbers')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('hides it from a teacher and sends them to their timetable', () => {
    signIn({ role: 'teacher' });
    renderOverview();

    expect(screen.queryByText('secret numbers')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/dashboard/timetable');
  });

  it('shows nothing, and redirects nowhere, while signed out', () => {
    renderOverview();

    expect(screen.queryByText('secret numbers')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
