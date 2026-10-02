import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { SchoolCalendar } from './SchoolCalendar';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const trip = {
  id: 'e1',
  title: 'Excursie la Sibiu',
  kind: 'trip',
  startDate: '2026-10-21',
  endDate: '2026-10-23',
  class: { id: 'c10b', name: '10B' },
};
const holiday = { id: 'e2', title: 'Vacanța de toamnă', kind: 'holiday', startDate: '2026-10-24', endDate: '2026-11-01', class: null };
const publicHoliday = {
  id: 'holiday-RO-2026-10-26',
  title: 'Sărbătoare de test',
  englishTitle: 'Test holiday',
  kind: 'holiday',
  startDate: '2026-10-26',
  endDate: '2026-10-26',
  class: null,
  national: true,
};

const signIn = (role: string) =>
  localStorage.setItem(
    'edudesk.session',
    JSON.stringify({ token: 'abc', user: { id: 'u1', firstName: 'Ana', lastName: 'Pop', role, schoolId: 's1' } }),
  );

const renderCalendar = () =>
  renderWithIntl(
    <AuthProvider>
      <SchoolCalendar />
    </AuthProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T09:00:00Z'));
  vi.mocked(api).mockImplementation(async (path: string, options) => {
    if (path.startsWith('/api/events') && options?.method !== 'DELETE' && !options?.body) return [trip, holiday, publicHoliday];
    if (path === '/api/classes') return [{ id: 'c10b', name: '10B' }];
    return {};
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(api).mockReset();
});

describe('SchoolCalendar', () => {
  it('loads the whole weeks around the month', async () => {
    signIn('teacher');
    renderCalendar();

    // October 2026 starts on a Thursday and ends on a Saturday
    expect(api).toHaveBeenCalledWith('/api/events?from=2026-09-28&to=2026-11-01', expect.anything());
    expect(await screen.findByRole('button', { name: /Excursie la Sibiu/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add event' })).not.toBeInTheDocument();
  });

  it('splits an event that crosses a week into one bar per week', async () => {
    signIn('teacher');
    renderCalendar();

    // Sat 24 – Sun 25 Oct, then Mon 26 Oct – Sun 1 Nov
    expect(await screen.findAllByRole('button', { name: /Vacanța de toamnă/ })).toHaveLength(2);
  });

  it('lets admins add and delete events', async () => {
    signIn('school_admin');
    renderCalendar();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '+ Add event' }));
    await user.type(screen.getByLabelText('Title'), 'Teză la fizică');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(api).toHaveBeenCalledWith('/api/events', {
      token: 'abc',
      body: { title: 'Teză la fizică', kind: 'exam', startDate: '2026-10-02', endDate: '2026-10-02', classId: null },
    });

    await user.click(screen.getByRole('button', { name: /Excursie la Sibiu/ }));
    await user.click(screen.getByRole('button', { name: 'Delete event' }));
    expect(api).toHaveBeenCalledWith('/api/events/e1', { token: 'abc', method: 'DELETE' });
  });

  it('shows public holidays in the current language, without a delete button', async () => {
    signIn('school_admin');
    renderCalendar();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /Test holiday/ }));

    expect(screen.getByText(/National public holiday/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument();
  });
});
