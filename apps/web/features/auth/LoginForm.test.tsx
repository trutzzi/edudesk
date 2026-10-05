import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { AuthProvider } from './AuthProvider';
import { LoginForm } from './LoginForm';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const session = {
  token: 'abc',
  user: { id: 'u1', email: 'ana@school.edu', firstName: 'Ana', lastName: 'Pop', role: 'teacher', schoolId: null },
};

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  renderWithIntl(
    <AuthProvider>
      <LoginForm />
    </AuthProvider>,
  );
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('LoginForm', () => {
  it('sends the credentials and saves the session', async () => {
    vi.mocked(api).mockResolvedValue(session);

    await submit('ana@school.edu', 'password123');

    expect(api).toHaveBeenCalledWith('/api/auth/login', {
      body: { email: 'ana@school.edu', password: 'password123' },
    });
    expect(localStorage.getItem('edudesk.session')).toContain('"token":"abc"');
  });

  it('offers a new confirmation link when the email is not verified', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Confirm your email', 403, 'EMAIL_NOT_VERIFIED'));

    await submit('ana@school.edu', 'password123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm your email before signing in');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send a new link' }));
    expect(api).toHaveBeenLastCalledWith('/api/auth/resend-verification', {
      body: { email: 'ana@school.edu', locale: 'en' },
    });
  });

  it('shows the error from the server', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Invalid email or password', 401));

    await submit('ana@school.edu', 'wrong-password');

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
});
