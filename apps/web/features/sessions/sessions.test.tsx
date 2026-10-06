import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { AttendanceDay } from './AttendanceDay';
import { ClientCard } from './ClientCard';
import { Reports } from './Reports';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const elena = { id: 't1', firstName: 'Elena', lastName: 'Pop' };
const dan = { id: 't2', firstName: 'Dan', lastName: 'Ene' };
const ana = { id: 'c1', firstName: 'Ana', lastName: 'Ionescu' };

// The screens ask for "today" from the browser's clock, so every date-keyed route answers for whatever date it's asked
const dateOf = (path: string) => /date=([\d-]+)/.exec(path)?.[1] ?? '';
const monthOf = (path: string) => /month=([\d-]+)/.exec(path)?.[1] ?? /from=([\d-]{7})/.exec(path)?.[1] ?? '';

function serve(editable = true) {
  vi.mocked(api).mockImplementation(async (path, options) => {
    if (options?.body) return {};
    if (path.startsWith('/api/attendance')) {
      const date = dateOf(path);
      return {
        date,
        today: date,
        editable,
        sessions: [
          {
            courseId: 'k1',
            courseName: 'Kineto',
            date,
            startTime: '09:00',
            endTime: '10:00',
            hours: 1,
            room: null,
            class: { id: 'r1', name: 'Sala Verde' },
            teacher: elena,
            clients: [
              {
                client: ana,
                status: 'present',
                markedAt: null,
                before: { courseName: 'Logopedie', startTime: '08:00', endTime: '08:50', teacher: dan },
                after: null,
              },
            ],
          },
        ],
      };
    }
    if (path === '/api/clients/c1') {
      return { ...ana, email: null, phone: '+40722111222', paymentType: 'sponsored', rooms: [{ id: 'r1', name: 'Sala Verde' }] };
    }
    if (path.startsWith('/api/clients/c1/sessions')) {
      const month = monthOf(path);
      return [
        {
          courseId: 'k1',
          courseName: 'Kineto',
          date: `${month}-05`,
          startTime: '09:00',
          endTime: '10:00',
          hours: 1,
          room: null,
          class: { id: 'r1', name: 'Sala Verde' },
          teacher: elena,
          status: 'present',
        },
        {
          courseId: 'k1',
          courseName: 'Kineto',
          date: `${month}-12`,
          startTime: '09:00',
          endTime: '10:00',
          hours: 1,
          room: null,
          class: { id: 'r1', name: 'Sala Verde' },
          teacher: elena,
          status: 'absent_late',
        },
      ];
    }
    if (path.startsWith('/api/reports')) {
      return {
        month: monthOf(path),
        clients: [
          {
            client: ana,
            sessions: 9,
            hours: 7.5,
            counts: { present: 8, absent_notice: 1, absent_late: 0, cancelled: 0 },
            therapies: ['Kineto'],
          },
        ],
        therapists: [{ teacher: elena, sessions: 8, hours: 7.5 }],
      };
    }
    return [];
  });
}

const render = (ui: React.ReactNode) => renderWithIntl(<AuthProvider>{ui}</AuthProvider>);

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('AttendanceDay', () => {
  it('marks a client and shows what therapy they have before', async () => {
    signIn({ role: 'teacher', id: 't1' });
    serve();
    render(<AttendanceDay />);

    const select = await screen.findByRole('combobox', { name: 'Attendance for Ana Ionescu' });
    expect(screen.getByText('Logopedie')).toBeInTheDocument();

    await userEvent.setup().selectOptions(select, 'absent_late');

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/api/attendance', {
        body: expect.objectContaining({ courseId: 'k1', startTime: '09:00', studentId: 'c1', status: 'absent_late' }),
        token: 'token',
      }),
    );
  });

  it("can't mark a session that hasn't happened", async () => {
    signIn({ role: 'teacher', id: 't1' });
    serve(false);
    render(<AttendanceDay />);

    expect(await screen.findByRole('combobox', { name: 'Attendance for Ana Ionescu' })).toBeDisabled();
  });
});

describe('ClientCard', () => {
  it('lets a therapist call or message the client, and shows the payment and month', async () => {
    signIn({ role: 'teacher', id: 't1' });
    serve();
    render(<ClientCard clientId="c1" />);

    expect(await screen.findByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+40722111222');
    expect(screen.getByRole('link', { name: 'WhatsApp message' }).getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/40722111222\?text=Salutare/,
    );
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
    expect(await screen.findByText('Absent, short notice', { selector: 'span' })).toBeInTheDocument();
  });

  it('shows a client their own history without contact buttons or payment', async () => {
    signIn({ role: 'student', id: 'c1' });
    serve();
    render(<ClientCard clientId="c1" />);

    expect(await screen.findByRole('heading', { name: 'Ana Ionescu' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument();
    expect(screen.queryByText('Sponsored')).not.toBeInTheDocument();
  });
});

describe('ClientCard errors', () => {
  it('says the client is missing only on a 404', async () => {
    signIn({ role: 'teacher', id: 't1' });
    vi.mocked(api).mockRejectedValue(new ApiError('', 404));
    render(<ClientCard clientId="c1" />);

    expect(await screen.findByText("This patient/client doesn't exist or you don't work with them.")).toBeInTheDocument();
  });

  it('shows what went wrong on a server error instead of "not found"', async () => {
    signIn({ role: 'teacher', id: 't1' });
    vi.mocked(api).mockRejectedValue(new ApiError('', 500));
    render(<ClientCard clientId="c1" />);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.queryByText(/doesn't exist/)).not.toBeInTheDocument();
  });
});

describe('Reports', () => {
  it("lists each client's month and each therapist's hours", async () => {
    signIn();
    serve();
    render(<Reports />);

    const therapists = (await screen.findByRole('heading', { name: 'Therapists' })).closest('section')!;
    expect(within(therapists).getByText('Elena Pop')).toBeInTheDocument();
    expect(within(therapists).getAllByText('7.5')).toHaveLength(1);
    const clients = screen.getByRole('heading', { name: 'Patients/Clients' }).closest('section')!;
    expect(within(clients).getByRole('link', { name: 'Ana Ionescu' })).toHaveAttribute('href', '/dashboard/clients/c1');
  });
});
