import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { AuthProvider } from './AuthProvider';
import { VerifyEmail } from './VerifyEmail';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const renderWith = (token: string | null) =>
  renderWithIntl(
    <AuthProvider>
      <VerifyEmail token={token} />
    </AuthProvider>,
  );

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('VerifyEmail', () => {
  it('confirms the email once and signs the user in', async () => {
    vi.mocked(api).mockResolvedValue({ token: 'abc', user: { firstName: 'Ana' } });

    renderWith('t0k3n');

    await waitFor(() => expect(localStorage.getItem('edudesk.session')).toContain('"token":"abc"'));
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/api/auth/verify-email', { body: { token: 't0k3n' } });
  });

  it('explains when the link is no longer valid', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('expired', 400, 'INVALID_TOKEN'));

    renderWith('old');

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid, already used or expired');
  });

  it('explains when the link has no token', () => {
    renderWith(null);

    expect(screen.getByRole('alert')).toHaveTextContent('missing its confirmation code');
    expect(api).not.toHaveBeenCalled();
  });
});
