import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { ClassList } from './ClassList';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const classes = [
  { id: 'c1', name: '9A', schoolYear: '2026-2027', studentsCount: 24 },
  { id: 'c2', name: '10B', schoolYear: '2026-2027', studentsCount: 1 },
];

const renderScreen = () =>
  renderWithIntl(
    <AuthProvider>
      <ClassList />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('ClassList', () => {
  it('shows each class with its student count and a link to it', async () => {
    vi.mocked(api).mockResolvedValue(classes);
    renderScreen();

    expect(await screen.findByText('24 students')).toBeInTheDocument();
    expect(screen.getByText('1 student')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /9A/ })).toHaveAttribute('href', '/dashboard/classes/c1');
  });

  it('invites the admin to create the first class', async () => {
    vi.mocked(api).mockResolvedValue([]);
    renderScreen();

    expect(await screen.findByText('No classes yet. Create the first one.')).toBeInTheDocument();
  });

  it('shows an error when the classes cannot be loaded', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderScreen();

    expect(await screen.findByText(/Couldn't load the classes/)).toBeInTheDocument();
  });

  it('creates a class from the form and reloads the list', async () => {
    vi.mocked(api).mockImplementation(async (_path, options) => (options?.method === 'POST' ? { id: 'c3' } : classes));
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('24 students');

    await user.click(screen.getByRole('button', { name: '+ New class' }));
    await user.type(screen.getByLabelText('Name'), '11C');
    await user.click(screen.getByRole('button', { name: 'Create class' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/classes', {
        method: undefined,
        body: { name: '11C', schoolYear: expect.stringMatching(/^\d{4}-\d{4}$/) },
        token: 'token',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('form', { name: 'New class' })).not.toBeInTheDocument());
    expect(vi.mocked(api).mock.calls.filter(([path]) => path === '/api/classes').length).toBeGreaterThan(2);
  });

  it('keeps the form open and explains why when creating fails', async () => {
    vi.mocked(api).mockImplementation(async (_path, options) => {
      if (options?.body) throw new ApiError('x', 429, 'RATE_LIMITED');
      return classes;
    });
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('24 students');

    await user.click(screen.getByRole('button', { name: '+ New class' }));
    await user.type(screen.getByLabelText('Name'), '11C');
    await user.click(screen.getByRole('button', { name: 'Create class' }));

    expect(await screen.findByText(/Too many attempts/)).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'New class' })).toBeInTheDocument();
  });

  it('can cancel the form', async () => {
    vi.mocked(api).mockResolvedValue(classes);
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('24 students');

    await user.click(screen.getByRole('button', { name: '+ New class' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: '+ New class' })).toBeInTheDocument();
  });
});
