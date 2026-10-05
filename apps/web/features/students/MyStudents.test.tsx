import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { MyStudents } from './MyStudents';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const ioana = { id: 's1', firstName: 'Ioana', lastName: 'Stan', email: 'ioana@demo.edu' };
const taught = [
  { id: 'c1', name: '9A', schoolYear: '2026-2027', students: [ioana] },
  { id: 'c2', name: '10B', schoolYear: '2026-2027', students: [] },
];

const serve = (classes: unknown) => vi.mocked(api).mockImplementation(async (path) => (path === '/api/classes/taught' ? classes : []));

const renderScreen = () =>
  renderWithIntl(
    <AuthProvider>
      <MyStudents />
    </AuthProvider>,
  );

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('MyStudents', () => {
  it('lists the teacher’s classes and their students', async () => {
    signIn({ role: 'teacher' });
    serve(taught);
    renderScreen();

    expect(await screen.findByRole('heading', { name: '9A' })).toBeInTheDocument();
    expect(screen.getByText('Ioana Stan')).toBeInTheDocument();
    expect(screen.getByText('No students in this class yet.')).toBeInTheDocument();
  });

  it('opens the student invitation form and closes it again', async () => {
    signIn({ role: 'teacher' });
    serve(taught);
    renderScreen();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '+ Invite a student' }));
    expect(screen.getByText('Invite someone to your school')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: '+ Invite a student' })).toBeInTheDocument();
  });

  it('explains when the teacher has no classes yet', async () => {
    signIn({ role: 'teacher' });
    serve([]);
    renderScreen();

    expect(await screen.findByText(/You don't teach any class yet/)).toBeInTheDocument();
  });

  it('is only for teachers', () => {
    signIn({ role: 'student' });
    renderScreen();

    expect(screen.getByText(/You don't teach any class yet/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it('shows an error when the classes cannot be loaded', async () => {
    signIn({ role: 'teacher' });
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderScreen();

    expect(await screen.findByText(/Couldn't load your classes/)).toBeInTheDocument();
  });
});
