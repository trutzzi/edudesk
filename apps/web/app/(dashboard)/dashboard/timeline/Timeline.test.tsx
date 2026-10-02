import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { Timeline } from './Timeline';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const elena = { id: 't1', firstName: 'Elena', lastName: 'Popescu' };
const mihai = { id: 't2', firstName: 'Mihai', lastName: 'Ionescu' };
const lessonOn = (date: string, courseName: string, className: string, teacher = elena) => ({
  id: `${courseName}-${className}`,
  courseId: `${courseName}-${className}`,
  courseName,
  date,
  startTime: '08:00',
  endTime: '08:50',
  room: null,
  class: { id: className, name: className },
  teacher,
});

const signIn = (role: string) =>
  localStorage.setItem(
    'edudesk.session',
    JSON.stringify({ token: 'abc', user: { id: 'u1', firstName: 'Ana', lastName: 'Pop', role, schoolId: 's1' } }),
  );

const renderTimeline = () =>
  renderWithIntl(
    <AuthProvider>
      <Timeline />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T05:20:00Z')); // Monday 08:20 in Bucharest
  vi.mocked(api).mockImplementation(async (path: string) => {
    if (path.startsWith('/api/events')) return [];
    return {
      timezone: 'Europe/Bucharest',
      lessons: [
        lessonOn('2026-10-05', 'Matematică', '9A'),
        lessonOn('2026-10-05', 'Limba română', '10B', mihai),
        lessonOn('2026-10-06', 'Matematică', '10B'),
      ],
    };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(api).mockReset();
});

describe('Timeline', () => {
  it('groups the week by class and marks what is in progress', async () => {
    signIn('school_admin');
    renderTimeline();

    expect(await screen.findByRole('button', { name: 'Collapse 9A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse 10B' })).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/api/timeline/lessons?from=2026-10-05&to=2026-10-11', expect.anything());
    // Both 08:00 lessons today are running at 08:20
    const panel = screen.getByRole('region', { name: 'Happening now' });
    expect(within(panel).getByText('Matematică')).toBeInTheDocument();
    expect(within(panel).getByText('Limba română')).toBeInTheDocument();
  });

  it('switches to grouping by teacher and filters by search', async () => {
    signIn('school_admin');
    renderTimeline();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: 'Collapse 9A' });

    await user.selectOptions(screen.getByLabelText('Group by'), 'teacher');
    expect(screen.getByRole('button', { name: 'Collapse Elena Popescu' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search courses, classes, teachers…'), 'romana');
    expect(screen.queryByRole('button', { name: 'Collapse Elena Popescu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse Mihai Ionescu' })).toBeInTheDocument();
  });

  it('loads whole courses for the term view', async () => {
    signIn('school_admin');
    renderTimeline();

    await userEvent.setup().selectOptions(screen.getByLabelText('Zoom'), 'term');

    expect(api).toHaveBeenCalledWith('/api/timeline/courses?from=2026-09-01&to=2027-01-31', expect.anything());
  });

  it('is only for school admins', () => {
    signIn('teacher');
    renderTimeline();

    expect(screen.getByText('Only school admins can see the timeline.')).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});
