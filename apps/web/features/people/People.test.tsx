import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { People } from './People';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const members = [
  { id: 'me', firstName: 'Ana', lastName: 'Pop', email: 'ana@school.ro', role: 'school_admin' },
  { id: 't1', firstName: 'Ion', lastName: 'Radu', email: 'ion@school.ro', role: 'teacher' },
  { id: 's1', firstName: 'Maria', lastName: 'Ene', email: 'maria@school.ro', role: 'student' },
];
const pending = [
  {
    id: 'i1',
    email: 'new@school.ro',
    role: 'parent',
    createdAt: '2026-10-01T00:00:00Z',
    expiresAt: '2099-10-08T00:00:00Z',
    expired: false,
    class: null,
    student: { id: 's1', firstName: 'Maria', lastName: 'Ene' },
  },
];

function serve(overrides: Record<string, unknown> = {}) {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method === 'DELETE') return undefined;
    const routes: Record<string, unknown> = {
      '/api/users': members,
      '/api/invitations': pending,
      '/api/classes': [],
      ...overrides,
    };
    return routes[path];
  });
}

const renderScreen = () =>
  renderWithIntl(
    <AuthProvider>
      <People />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  vi.restoreAllMocks();
});

describe('People', () => {
  it('groups the members by role and lists the pending invitations', async () => {
    serve();
    renderScreen();

    expect(await screen.findByText('Ion Radu')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Teachers (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Students (1)' })).toBeInTheDocument();
    expect(await screen.findByText('new@school.ro')).toBeInTheDocument();
    expect(screen.getByText('parent of Maria Ene ·', { exact: false })).toBeInTheDocument();
  });

  it('filters by name or email, and says when nobody matches', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.type(screen.getByRole('searchbox'), 'maria@');
    expect(screen.queryByText('Ion Radu')).not.toBeInTheDocument();
    expect(screen.getByText('Maria Ene')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'nobody');
    expect(screen.getByText('No one matches your search.')).toBeInTheDocument();
  });

  it('removes a member after confirming, but never offers to remove yourself', async () => {
    serve();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderScreen();
    await screen.findByText('Ion Radu');

    expect(screen.queryByRole('button', { name: 'Remove Ana Pop from the school' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Ion Radu from the school' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Ion Radu'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/users/t1', { method: 'DELETE', token: 'token' }));
  });

  it('does nothing when the removal is not confirmed', async () => {
    serve();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderScreen();
    await screen.findByText('Ion Radu');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Ion Radu from the school' }));

    expect(api).not.toHaveBeenCalledWith('/api/users/t1', expect.anything());
  });

  it('opens the invitation form and closes it again', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.click(screen.getByRole('button', { name: '+ Invite someone' }));
    expect(screen.getByText('Invite someone to your school')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: '+ Invite someone' })).toBeInTheDocument();
  });

  it('shows an error when the members cannot be loaded', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderScreen();

    expect(await screen.findByText(/Couldn't load the people in your school/)).toBeInTheDocument();
  });

  it('shows the empty state for invitations', async () => {
    serve({ '/api/invitations': [] });
    renderScreen();

    const section = (await screen.findByRole('heading', { name: 'Pending invitations' })).closest('section')!;
    expect(await within(section).findByText('No pending invitations.')).toBeInTheDocument();
  });
});
