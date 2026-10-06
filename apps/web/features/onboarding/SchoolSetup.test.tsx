import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { SchoolSetup } from './SchoolSetup';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('SchoolSetup', () => {
  it('creates the school and swaps in the new session', async () => {
    localStorage.setItem('edudesk.session', JSON.stringify({ token: 'old', user: { role: 'school_admin', schoolId: null } }));
    vi.mocked(api).mockImplementation(async (path) =>
      path === '/api/invitations/mine' ? [] : { token: 'new', user: { role: 'school_admin', schoolId: 's1' } },
    );
    renderWithIntl(
      <AuthProvider>
        <SchoolSetup />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Institution name'), 'Liceul Teoretic');
    await user.type(screen.getByLabelText('Institution code'), 'LT-CLUJ');
    await user.click(screen.getByRole('button', { name: 'Create institution' }));

    expect(api).toHaveBeenCalledWith('/api/schools', {
      token: 'old',
      body: { name: 'Liceul Teoretic', code: 'LT-CLUJ', timezone: 'Europe/Bucharest' },
    });
    await waitFor(() => expect(localStorage.getItem('edudesk.session')).toContain('"schoolId":"s1"'));
  });
});
