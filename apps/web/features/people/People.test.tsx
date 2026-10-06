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

const staff = { phone: null, paymentType: null, specializations: [] };
const members = [
  { id: 'me', firstName: 'Ana', lastName: 'Pop', email: 'ana@school.ro', role: 'school_admin', ...staff },
  {
    ...staff,
    id: 't1',
    firstName: 'Ion',
    lastName: 'Radu',
    email: 'ion@school.ro',
    role: 'teacher',
    specializations: [
      { id: 'aba', name: 'ABA' },
      { id: 'kin', name: 'Kineto' },
    ],
  },
  {
    id: 's1',
    firstName: 'Maria',
    lastName: 'Ene',
    email: null,
    phone: '+40722111222',
    role: 'student',
    paymentType: 'cas',
    specializations: [],
  },
  {
    id: 's2',
    firstName: 'Vlad',
    lastName: 'Ene',
    email: 'vlad@school.ro',
    phone: null,
    role: 'student',
    paymentType: null,
    specializations: [],
  },
];
const therapies = ['ABA', 'Kineto', 'Shadow'].map((name) => ({
  id: name.slice(0, 3).toLowerCase(),
  name,
  coursesCount: 0,
  therapistsCount: 0,
}));
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
    if (options?.method === 'DELETE' || options?.body) return {};
    const routes: Record<string, unknown> = {
      '/api/users': members,
      '/api/invitations': pending,
      '/api/classes': [],
      '/api/therapies': therapies,
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
    expect(screen.getByRole('heading', { name: 'Therapists (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Patients/Clients (2)' })).toBeInTheDocument();
    expect(await screen.findByText('new@school.ro')).toBeInTheDocument();
    expect(screen.getByText('parent of Maria Ene ·', { exact: false })).toBeInTheDocument();
  });

  it('filters by name or email, and says when nobody matches', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.type(screen.getByRole('searchbox'), '0722111');
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

    expect(screen.queryByRole('button', { name: 'Remove Ana Pop from the institution' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Ion Radu from the institution' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Ion Radu'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/users/t1', { method: 'DELETE', token: 'token' }));
  });

  it('does nothing when the removal is not confirmed', async () => {
    serve();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderScreen();
    await screen.findByText('Ion Radu');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Ion Radu from the institution' }));

    expect(api).not.toHaveBeenCalledWith('/api/users/t1', expect.anything());
  });

  it('opens the invitation form and closes it again', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.click(screen.getByRole('button', { name: 'Invite by email' }));
    expect(screen.getByText('Invite someone to your institution')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Invite by email' })).toBeInTheDocument();
  });

  it("shows a client's phone and payment, and a therapist's specializations", async () => {
    serve();
    renderScreen();

    expect(await screen.findByText('+40722111222')).toBeInTheDocument();
    expect(screen.getByText('Covered by CAS')).toBeInTheDocument();
    expect(screen.getByText('Kineto')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Maria Ene' })).toHaveAttribute('href', '/dashboard/clients/s1');
  });

  it('creates a client with a phone and a password, without an invitation', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.click(screen.getByRole('button', { name: '+ Patient/Client' }));
    await user.type(screen.getByLabelText('First name'), 'Luca');
    await user.type(screen.getByLabelText('Last name'), 'Barbu');
    await user.type(screen.getByLabelText('Phone'), '0722 333 444');
    // An easy password is already there for the admin to read out
    const password = screen.getByLabelText<HTMLInputElement>('Password').value;
    expect(password).toMatch(/^[a-z2-9]{6}$/);
    await user.selectOptions(screen.getByLabelText('Payment type'), 'sponsored');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/users', {
        body: {
          firstName: 'Luca',
          lastName: 'Barbu',
          phone: '0722 333 444',
          email: null,
          details: '',
          notes: '',
          password,
          paymentType: 'sponsored',
          role: 'student',
        },
        token: 'token',
      }),
    );
    expect(await screen.findByText(new RegExp(`The account was created. Password: ${password}`))).toBeInTheDocument();
  });

  it("edits a therapist's specializations", async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.click(screen.getByRole('button', { name: "Edit Ion Radu's details" }));
    await user.click(await screen.findByRole('checkbox', { name: 'ABA' }));
    await user.click(screen.getByRole('checkbox', { name: 'Shadow' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/users/t1', {
        method: 'PATCH',
        body: {
          firstName: 'Ion',
          lastName: 'Radu',
          phone: '',
          email: 'ion@school.ro',
          details: '',
          notes: '',
          specializations: ['kin', 'sha'],
        },
        token: 'token',
      }),
    );
  });

  it('gives someone who forgot their password a new one the admin can read out', async () => {
    serve();
    renderScreen();
    const user = userEvent.setup();
    await screen.findByText('Ion Radu');

    await user.click(screen.getByRole('button', { name: "Edit Maria Ene's details" }));
    expect(screen.getByLabelText('New password (optional)')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Generate' }));
    const password = screen.getByLabelText<HTMLInputElement>('New password (optional)').value;
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText(new RegExp(`Changes saved. New password: ${password}`))).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/api/users/s1', expect.objectContaining({ body: expect.objectContaining({ password }) }));
  });

  it('shows an error when the members cannot be loaded', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderScreen();

    expect(await screen.findByText(/Couldn't load the people in your institution/)).toBeInTheDocument();
  });

  it('shows the empty state for invitations', async () => {
    serve({ '/api/invitations': [] });
    renderScreen();

    const section = (await screen.findByRole('heading', { name: 'Pending invitations' })).closest('section')!;
    expect(await within(section).findByText('No pending invitations.')).toBeInTheDocument();
  });
});
