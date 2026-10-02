import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { MyTimetable } from './MyTimetable';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const math = {
  id: 'l1',
  courseId: 'm1',
  courseName: 'Matematică',
  date: '2026-10-05',
  startTime: '08:00',
  endTime: '08:50',
  room: 'Sala 101',
  class: { id: 'c9a', name: '9A' },
  teacher: { id: 't1', firstName: 'Elena', lastName: 'Popescu' },
};

const signIn = (role: string) =>
  localStorage.setItem('edudesk.session', JSON.stringify({ token: 'abc', user: { role, schoolId: 's1' } }));

const renderTimetable = () =>
  renderWithIntl(
    <AuthProvider>
      <MyTimetable />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T05:20:00Z')); // Monday 08:20 in Bucharest
  vi.mocked(api).mockImplementation(async (path: string) =>
    path.startsWith('/api/events') ? [] : { timezone: 'Europe/Bucharest', lessons: [math] },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(api).mockReset();
});

describe('MyTimetable', () => {
  it('loads this week and marks the lesson in progress', async () => {
    signIn('student');
    renderTimetable();

    expect((await screen.findAllByText('Matematică')).length).toBeGreaterThan(0);
    expect(api).toHaveBeenCalledWith('/api/timetable?from=2026-10-05&to=2026-10-11', expect.anything());
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    // A student sees who teaches
    expect(screen.getAllByText('Elena Popescu').length).toBeGreaterThan(0);
  });

  it('shows a teacher which class', async () => {
    signIn('teacher');
    renderTimetable();

    expect((await screen.findAllByText('9A')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Elena Popescu')).not.toBeInTheDocument();
  });

  it('shows the whole weeks around the month and opens a week from a day', async () => {
    signIn('student');
    renderTimetable();
    const user = userEvent.setup({ advanceTimers: () => {} });

    await user.click(await screen.findByRole('button', { name: 'Month' }));

    // October 2026 starts on a Thursday and ends on a Saturday: Mon 28 Sep to Sun 1 Nov
    expect(api).toHaveBeenCalledWith('/api/timetable?from=2026-09-28&to=2026-11-01', expect.anything());
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open the week of Monday, October 5' }));
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(api).toHaveBeenLastCalledWith('/api/events?from=2026-10-05&to=2026-10-11', expect.anything());
  });

  it('shows one day with the current time on the cursor', async () => {
    signIn('teacher');
    renderTimetable();
    const user = userEvent.setup({ advanceTimers: () => {} });

    await user.click(await screen.findByRole('button', { name: 'Day' }));

    expect(api).toHaveBeenCalledWith('/api/timetable?from=2026-10-05&to=2026-10-05', expect.anything());
    expect(screen.getByRole('heading', { name: 'Monday, October 5, 2026' })).toBeInTheDocument();
    expect(await screen.findByText('08:20')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Tuesday, October 6, 2026' })).toBeInTheDocument();
    // Not today any more, so no cursor
    expect(screen.queryByText('08:20')).not.toBeInTheDocument();
  });

  it('shows a parent the same as their child', async () => {
    signIn('parent');
    renderTimetable();

    expect((await screen.findAllByText('Elena Popescu')).length).toBeGreaterThan(0);
    expect(screen.queryByText('9A · Elena Popescu')).not.toBeInTheDocument();
  });

  it('points admins to the timeline', () => {
    signIn('school_admin');
    renderTimetable();

    expect(screen.getByText(/As an admin, use the Timeline/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
