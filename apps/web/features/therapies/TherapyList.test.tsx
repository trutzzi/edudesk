import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { TherapyList } from './TherapyList';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const therapies = [
  { id: 'kin', name: 'Kineto', coursesCount: 3, therapistsCount: 2 },
  { id: 'mel', name: 'Meloterapie', coursesCount: 0, therapistsCount: 0 },
];

const render = async () => {
  renderWithIntl(
    <AuthProvider>
      <TherapyList />
    </AuthProvider>,
  );
  await screen.findByText('Kineto');
};

beforeEach(() => {
  signIn();
  vi.mocked(api).mockImplementation(async (_path, options) => (options?.method || options?.body ? {} : therapies));
});

afterEach(() => {
  vi.mocked(api).mockReset();
  vi.restoreAllMocks();
});

describe('TherapyList', () => {
  it('shows where each therapy is used', async () => {
    await render();

    expect(screen.getByText('in 3 rooms · 2 therapists')).toBeInTheDocument();
    expect(screen.getByText('in no room · no therapist')).toBeInTheDocument();
  });

  it('adds a therapy', async () => {
    await render();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Therapy name'), 'Hipoterapie');
    await user.click(screen.getByRole('button', { name: '+ Add therapy' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/therapies', { body: { name: 'Hipoterapie' }, token: 'token' }));
  });

  it('renames a therapy', async () => {
    await render();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Rename Kineto' }));
    // The add field is the first "Therapy name", the one being renamed the second
    const input = screen.getAllByLabelText('Therapy name')[1]!;
    await user.clear(input);
    await user.type(input, 'Kinetoterapie');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/therapies/kin', { method: 'PATCH', body: { name: 'Kinetoterapie' }, token: 'token' }),
    );
  });

  it('deletes only a therapy no room runs', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await render();

    expect(screen.getByRole('button', { name: 'Delete Kineto' })).toBeDisabled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Meloterapie' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/therapies/mel', { method: 'DELETE', token: 'token' }));
  });
});
