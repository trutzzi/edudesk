import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { SchoolSetup } from './SchoolSetup';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
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

    await user.type(screen.getByLabelText('School name'), 'Liceul Teoretic');
    await user.type(screen.getByLabelText('School code'), 'LT-CLUJ');
    await user.click(screen.getByRole('button', { name: 'Create school' }));

    expect(api).toHaveBeenCalledWith('/api/schools', {
      token: 'old',
      body: { name: 'Liceul Teoretic', code: 'LT-CLUJ', timezone: 'Europe/Bucharest' },
    });
    await waitFor(() => expect(localStorage.getItem('edudesk.session')).toContain('"schoolId":"s1"'));
  });
});
