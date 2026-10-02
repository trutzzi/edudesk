import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { AcceptInvitation } from './AcceptInvitation';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const invitation = { email: 'ion@school.ro', role: 'teacher', schoolName: 'Liceul Demo', hasAccount: false };
const session = { token: 'new', user: { firstName: 'Ion', role: 'teacher', schoolId: 's1' } };

const renderPage = (token: string | null = 'abc') =>
  renderWithIntl(
    <AuthProvider>
      <AcceptInvitation token={token} />
    </AuthProvider>,
  );

afterEach(() => {
  vi.mocked(api).mockReset();
  replace.mockReset();
});

describe('AcceptInvitation', () => {
  it('creates the account for someone new and signs them in', async () => {
    vi.mocked(api).mockImplementation(async (path) => (path.startsWith('/api/invitations/lookup') ? invitation : session));
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole('heading', { name: 'Join Liceul Demo' })).toBeInTheDocument();
    expect(screen.getByText("You've been invited to join Liceul Demo on EduDesk as a teacher.")).toBeInTheDocument();
    await user.type(screen.getByLabelText('First name'), 'Ion');
    await user.type(screen.getByLabelText('Last name'), 'Nou');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Accept and continue' }));

    expect(api).toHaveBeenLastCalledWith('/api/invitations/accept', {
      body: { firstName: 'Ion', lastName: 'Nou', password: 'password123', token: 'abc' },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard/timetable'));
    expect(localStorage.getItem('edudesk.session')).toContain('"token":"new"');
  });

  it('only asks for the password when the account exists', async () => {
    vi.mocked(api).mockImplementation(async (path) => {
      if (path.startsWith('/api/invitations/lookup')) return { ...invitation, hasAccount: true };
      throw new ApiError('wrong', 401, 'WRONG_PASSWORD');
    });
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Password'), 'not-it');
    expect(screen.queryByLabelText('First name')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept and continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("That's not the password for this account.");
    expect(replace).not.toHaveBeenCalled();
  });

  it('explains when the link no longer works', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('used', 404, 'INVALID_INVITATION'));
    renderPage();

    expect(await screen.findByRole('heading', { name: "This invitation can't be used" })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('already used or expired');
  });

  it('needs a token', () => {
    renderPage(null);

    expect(screen.getByRole('heading', { name: "This invitation can't be used" })).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
