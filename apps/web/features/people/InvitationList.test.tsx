import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { InvitationList } from './InvitationList';
import type { Invitation } from './types';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const invitation: Invitation = {
  id: 'i1',
  email: 'new@school.ro',
  role: 'student',
  createdAt: '2026-10-01T00:00:00Z',
  expiresAt: '2099-10-08T00:00:00Z',
  expired: false,
  class: { id: 'c1', name: '9A' },
  student: null,
};

const onChanged = vi.fn();
const renderList = (invitations: Invitation[]) =>
  renderWithIntl(
    <AuthProvider>
      <InvitationList invitations={invitations} onChanged={onChanged} />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onChanged.mockReset();
  vi.restoreAllMocks();
});

describe('InvitationList', () => {
  it('shows who was invited, into which class and until when', () => {
    renderList([invitation]);

    expect(screen.getByText('new@school.ro')).toBeInTheDocument();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText(/into 9A/)).toBeInTheDocument();
    expect(screen.getByText(/Expires/)).toBeInTheDocument();
  });

  it('marks an expired invitation', () => {
    renderList([{ ...invitation, expired: true }]);

    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('says so when there is nothing pending', () => {
    renderList([]);

    expect(screen.getByText('No pending invitations.')).toBeInTheDocument();
  });

  it('resends with the current language and confirms it', async () => {
    vi.mocked(api).mockResolvedValue({});
    renderList([invitation]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Resend' }));

    expect(api).toHaveBeenCalledWith('/api/invitations/i1/resend', { body: { locale: 'en' }, token: 'token' });
    expect(await screen.findByRole('button', { name: '✓ Sent again' })).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('revokes only after confirming', async () => {
    vi.mocked(api).mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderList([invitation]);
    const user = userEvent.setup();
    const revoke = screen.getByRole('button', { name: 'Revoke the invitation for new@school.ro' });

    await user.click(revoke);
    expect(api).not.toHaveBeenCalled();

    await user.click(revoke);
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/invitations/i1', { method: 'DELETE', token: 'token' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows the error and keeps the list when resending fails', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('x', 409, 'INVITATION_PENDING'));
    renderList([invitation]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Resend' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
