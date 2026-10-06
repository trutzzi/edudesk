import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { setLocale } from '@/i18n/actions';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { Profile } from './Profile';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));
vi.mock('@/i18n/actions', () => ({ setLocale: vi.fn() }));

const me = {
  id: 'me',
  firstName: 'Ana',
  lastName: 'Pop',
  email: null,
  phone: '+40722111222',
  role: 'teacher',
  paymentType: null,
  specializations: [{ id: 'aba', name: 'ABA' }],
  details: '10 ani de ABA',
  notes: null,
  locale: null,
};
const therapies = [
  { id: 'aba', name: 'ABA', coursesCount: 0, therapistsCount: 1 },
  { id: 'kin', name: 'Kineto', coursesCount: 0, therapistsCount: 0 },
];

function serve() {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === 'PATCH') return { ...me, ...(options.body as object) };
    if (options?.method) return {};
    return path === '/api/therapies' ? therapies : me;
  });
}

const render = async () => {
  renderWithIntl(
    <AuthProvider>
      <Profile />
    </AuthProvider>,
  );
  await screen.findByDisplayValue('10 ani de ABA');
};

afterEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(setLocale).mockReset();
});

describe('Profile', () => {
  it('saves the details and a therapist’s own skills', async () => {
    signIn({ role: 'teacher' });
    serve();
    await render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Notes'), 'Lucrez marți și joi');
    await user.click(await screen.findByRole('checkbox', { name: 'Kineto' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/me', {
        method: 'PATCH',
        body: {
          firstName: 'Ana',
          lastName: 'Pop',
          phone: '+40722111222',
          email: null,
          details: '10 ani de ABA',
          notes: 'Lucrez marți și joi',
          specializations: ['aba', 'kin'],
        },
        token: 'token',
      }),
    );
    expect(await screen.findByText(/Saved\./)).toBeInTheDocument();
  });

  it('changes the language, keeping it with the account', async () => {
    signIn({ role: 'student' });
    serve();
    await render();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Română' }));

    await waitFor(() => expect(setLocale).toHaveBeenCalledWith('ro'));
    expect(api).toHaveBeenCalledWith('/api/me', { method: 'PATCH', body: { locale: 'ro' }, token: 'token' });
    expect(JSON.parse(localStorage.getItem('edudesk.session')!).user.locale).toBe('ro');
    // Clients don't pick therapies
    expect(screen.queryByText('Specializations')).not.toBeInTheDocument();
  });

  it('changes the password with the current one', async () => {
    signIn();
    serve();
    await render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Current password'), 'vechi1');
    await user.type(screen.getByLabelText('New password (at least 6 characters)'), 'nou234');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByText(/Your password was changed/)).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/api/me/password', {
      method: 'PUT',
      body: { currentPassword: 'vechi1', newPassword: 'nou234' },
      token: 'token',
    });
  });
});
