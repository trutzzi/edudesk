import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/renderWithIntl';
import { DashboardHeader } from './DashboardHeader';

vi.mock('@/i18n/actions', () => ({ setLocale: vi.fn() }));

const user = { id: 'u1', email: 'ana@school.ro', firstName: 'Ana', lastName: 'Pop', role: 'teacher' as const, schoolId: 's1' };

describe('DashboardHeader', () => {
  it('shows who is signed in, with their role', () => {
    renderWithIntl(<DashboardHeader user={user} onLogout={vi.fn()} />);

    expect(screen.getByText('Ana Pop')).toBeInTheDocument();
    expect(screen.getByText('Therapist')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Blue/ })).toHaveAttribute('href', '/');
  });

  it('shows the role in the chosen language', () => {
    renderWithIntl(<DashboardHeader user={user} onLogout={vi.fn()} />, 'ro');

    expect(screen.getByText('Terapeut')).toBeInTheDocument();
  });

  it('logs out', async () => {
    const onLogout = vi.fn();
    renderWithIntl(<DashboardHeader user={user} onLogout={onLogout} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));

    expect(onLogout).toHaveBeenCalled();
  });
});
