import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { NoSchool } from './SchoolSetup';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const invitation = { id: 'i1', role: 'teacher', schoolName: 'Astra Pitesti', invitedBy: 'Ana Pop', className: null };

const renderScreen = () =>
  renderWithIntl(
    <AuthProvider>
      <NoSchool />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.setItem(
    'edudesk.session',
    JSON.stringify({ token: 'old', user: { email: 'alina@school.ro', role: 'teacher', schoolId: null } }),
  );
});

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('NoSchool', () => {
  it('joins an invitation with one click and swaps in the new session', async () => {
    vi.mocked(api).mockImplementation(async (path) =>
      path === '/api/invitations/mine' ? [invitation] : { token: 'new', user: { role: 'teacher', schoolId: 's1' } },
    );
    renderScreen();

    expect(await screen.findByText('Astra Pitesti invited you to join as a teacher.')).toBeInTheDocument();
    expect(screen.getByText('Invited by Ana Pop')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Join Astra Pitesti' }));

    expect(api).toHaveBeenCalledWith('/api/invitations/mine/i1/accept', { method: 'POST', token: 'old' });
    await waitFor(() => expect(localStorage.getItem('edudesk.session')).toContain('"schoolId":"s1"'));
  });

  it('says which email to give the admin, and can check again', async () => {
    vi.mocked(api).mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText(/Ask your school's admin to invite alina@school.ro/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });
});
