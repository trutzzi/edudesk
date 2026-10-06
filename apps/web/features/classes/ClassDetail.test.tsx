import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { ClassDetail } from './ClassDetail';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const ioana = { id: 's1', firstName: 'Ioana', lastName: 'Stan', email: 'ioana@demo.edu' };
const radu = { id: 's2', firstName: 'Radu', lastName: 'Marin', email: 'radu@demo.edu' };
const details = {
  id: 'c9a',
  name: '9A',
  schoolYear: '2026-2027',
  students: [ioana],
  courses: [
    {
      id: 'm1',
      name: 'Matematică',
      description: null,
      startDate: '2026-09-07',
      endDate: '2027-06-18',
      teacherId: 't1',
      teacherFirstName: 'Elena',
      teacherLastName: 'Popescu',
      lessonsCount: 4,
    },
  ],
};

beforeEach(() => {
  localStorage.setItem('edudesk.session', JSON.stringify({ token: 'abc', user: { role: 'school_admin', schoolId: 's1' } }));
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.method || options?.body) return null;
    if (path === '/api/users?role=student') return [ioana, radu];
    if (path === '/api/users?role=teacher') return [];
    return details;
  });
});

afterEach(() => {
  vi.mocked(api).mockReset();
  vi.restoreAllMocks();
});

const renderDetail = () =>
  renderWithIntl(
    <AuthProvider>
      <ClassDetail classId="c9a" />
    </AuthProvider>,
  );

describe('ClassDetail', () => {
  it('shows the courses and offers only students not yet in the class', async () => {
    renderDetail();

    expect(await screen.findByRole('heading', { name: '9A' })).toBeInTheDocument();
    expect(screen.getByText('4 lessons a week')).toBeInTheDocument();
    const picker = await screen.findByLabelText('Add patient/client');
    expect(picker).toHaveTextContent('Marin Radu');
    expect(picker).not.toHaveTextContent('Stan Ioana');
  });

  it('adds a student', async () => {
    renderDetail();
    const user = userEvent.setup();

    await user.selectOptions(await screen.findByLabelText('Add patient/client'), 's2');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(api).toHaveBeenCalledWith('/api/classes/c9a/students', { token: 'abc', body: { studentId: 's2' } });
  });

  it('asks before deleting a course', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDetail();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Matematică' }));
    expect(confirm).toHaveBeenCalled();
    expect(api).not.toHaveBeenCalledWith('/api/courses/m1', expect.anything());

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Delete Matematică' }));
    expect(api).toHaveBeenCalledWith('/api/courses/m1', { token: 'abc', method: 'DELETE' });
  });

  it('deletes the class after confirming and goes back to the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDetail();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Delete room' }));

    expect(api).toHaveBeenCalledWith('/api/classes/c9a', { token: 'abc', method: 'DELETE' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/classes'));
  });
});
