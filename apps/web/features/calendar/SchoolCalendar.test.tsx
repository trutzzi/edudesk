import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { SchoolCalendar } from './SchoolCalendar';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
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

// Both views are in the page; CSS shows the grid from sm up and the list on phones
const grid = () => within(screen.getByRole('group', { name: 'Month grid' }));
const agenda = () => within(screen.getByRole('list', { name: "This month's events" }));

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
    signIn({ role: 'teacher' }, 'abc');
    renderCalendar();

    // October 2026 starts on a Thursday and ends on a Saturday
    expect(api).toHaveBeenCalledWith('/api/events?from=2026-09-28&to=2026-11-01', expect.anything());
    expect(await grid().findByRole('button', { name: /Excursie la Sibiu/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add event' })).not.toBeInTheDocument();
  });

  it('splits an event that crosses a week into one bar per week', async () => {
    signIn({ role: 'teacher' }, 'abc');
    renderCalendar();

    // Sat 24 – Sun 25 Oct, then Mon 26 Oct – Sun 1 Nov
    expect(await grid().findAllByRole('button', { name: /Vacanța de toamnă/ })).toHaveLength(2);
  });

  it('lists the month on phones in date order, one entry per event', async () => {
    signIn({ role: 'teacher' }, 'abc');
    renderCalendar();

    await grid().findAllByRole('button', { name: /Vacanța de toamnă/ });
    const entries = agenda()
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(entries).toEqual([
      expect.stringContaining('Excursie la Sibiu'),
      expect.stringContaining('Vacanța de toamnă'),
      expect.stringContaining('Test holiday'),
    ]);

    await userEvent.setup().click(agenda().getByRole('button', { name: /Excursie la Sibiu/ }));
    expect(screen.getByRole('region', { name: 'Excursie la Sibiu' })).toHaveTextContent('10B');
  });

  it('lets admins add and delete events', async () => {
    signIn({ role: 'school_admin' }, 'abc');
    renderCalendar();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: '+ Add event' }));
    await user.type(screen.getByLabelText('Title'), 'Teză la fizică');
    await user.click(screen.getByRole('button', { name: 'Save event' }));
    expect(api).toHaveBeenCalledWith('/api/events', {
      token: 'abc',
      body: { title: 'Teză la fizică', kind: 'exam', startDate: '2026-10-02', endDate: '2026-10-02', classId: null },
    });

    await user.click(grid().getByRole('button', { name: /Excursie la Sibiu/ }));
    await user.click(screen.getByRole('button', { name: 'Delete event' }));
    expect(api).toHaveBeenCalledWith('/api/events/e1', { token: 'abc', method: 'DELETE' });
  });

  it('shows public holidays in the current language, without a delete button', async () => {
    signIn({ role: 'school_admin' }, 'abc');
    renderCalendar();
    const user = userEvent.setup();

    await user.click(await grid().findByRole('button', { name: /Test holiday/ }));

    expect(screen.getByText(/National public holiday/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete event' })).not.toBeInTheDocument();
  });
});
