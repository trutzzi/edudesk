import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { HeroActions, NavActions } from './LandingActions';

const renderBoth = () =>
  renderWithIntl(
    <AuthProvider>
      <NavActions />
      <HeroActions />
    </AuthProvider>,
  );

describe('landing actions', () => {
  it('offers sign-in and sign-up to visitors', () => {
    renderBoth();

    expect(screen.getAllByRole('link', { name: 'Sign in' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/register');
  });

  it('sends a signed-in admin to the overview, and lets them log out', async () => {
    signIn({ role: 'school_admin' });
    renderBoth();

    expect(screen.getByText('Ana Pop')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Go to your dashboard →' })).toHaveAttribute('href', '/dashboard');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));

    expect(await screen.findByRole('link', { name: 'Get started' })).toBeInTheDocument();
    expect(localStorage.getItem('edudesk.session')).toBeNull();
  });

  it('sends a signed-in student to their timetable', () => {
    signIn({ role: 'student' });
    renderBoth();

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard/timetable');
  });
});
