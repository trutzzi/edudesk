import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { AuthProvider } from './AuthProvider';
import { RegisterForm } from './RegisterForm';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

async function fillAndSubmit() {
  const user = userEvent.setup();
  renderWithIntl(
    <AuthProvider>
      <RegisterForm />
    </AuthProvider>,
  );
  await user.type(screen.getByLabelText('First name'), 'Ana');
  await user.type(screen.getByLabelText('Last name'), 'Pop');
  await user.type(screen.getByLabelText('Email'), 'ana@school.edu');
  await user.selectOptions(screen.getByLabelText('Role'), 'parent');
  await user.type(screen.getByLabelText('Password'), 'password123');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('RegisterForm', () => {
  it('defaults the role to teacher', () => {
    renderWithIntl(
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>,
    );

    expect(screen.getByLabelText('Role')).toHaveValue('teacher');
  });

  it('sends the form data, the honeypot and the language to the API', async () => {
    vi.mocked(api).mockResolvedValue({ message: 'Check your email' });

    await fillAndSubmit();

    expect(api).toHaveBeenCalledWith('/api/auth/register', {
      body: {
        website: '',
        firstName: 'Ana',
        lastName: 'Pop',
        email: 'ana@school.edu',
        role: 'parent',
        password: 'password123',
        locale: 'en',
      },
    });
  });

  it('signs the user in when no email verification is needed', async () => {
    vi.mocked(api).mockResolvedValue({ token: 'abc', user: { firstName: 'Ana' } });

    await fillAndSubmit();

    expect(localStorage.getItem('edudesk.session')).toContain('"token":"abc"');
  });

  it('asks the user to check their inbox when verification is on', async () => {
    vi.mocked(api).mockResolvedValue({ message: 'Check your email' });

    await fillAndSubmit();

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(screen.getByText(/ana@school.edu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a new link' })).toBeInTheDocument();
    expect(localStorage.getItem('edudesk.session')).toBeNull();
  });

  it('keeps the honeypot out of reach of keyboard users', () => {
    renderWithIntl(
      <AuthProvider>
        <RegisterForm />
      </AuthProvider>,
    );

    expect(document.querySelector('input[name="website"]')).toHaveAttribute('tabindex', '-1');
  });

  it('shows the error from the server', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('An account with this email already exists', 409));

    await fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists');
  });
});
