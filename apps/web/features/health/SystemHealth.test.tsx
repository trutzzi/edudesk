import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { SystemHealth } from './SystemHealth';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const summary = {
  generatedAt: '2026-10-02T07:20:00Z',
  rangeHours: 24,
  totals: { errors: 2, warnings: 5, slow: 1, webErrors: 1 },
  topPaths: [{ method: 'GET', path: '/api/classes/:id', count: 4, errors: 0, commonStatus: 404 }],
  timeline: [
    { start: '2026-10-02T05:00:00Z', errors: 1, warnings: 3 },
    { start: '2026-10-02T06:00:00Z', errors: 1, warnings: 2 },
  ],
  server: { uptimeSeconds: 7200, dbLatencyMs: 0.8, memoryMb: 120 },
};
const entry = {
  id: '9',
  createdAt: '2026-10-02T06:10:00Z',
  level: 'error',
  source: 'api',
  method: 'POST',
  path: '/api/courses',
  status: 500,
  durationMs: 40,
  message: 'Internal server error',
  code: null,
  detail: 'Error: database is on fire\n    at courses.ts:42',
  user: { id: 'u1', name: 'Admin Demo', email: 'admin@demo.edu' },
};

beforeEach(() => {
  signIn({ role: 'super_admin', schoolId: null }, 'abc');
  vi.mocked(api).mockImplementation(async (path: string) =>
    path.startsWith('/api/monitoring/summary') ? summary : { entries: [entry], hasMore: false },
  );
});

afterEach(() => {
  vi.mocked(api).mockReset();
});

const renderPanel = () =>
  renderWithIntl(
    <AuthProvider>
      <SystemHealth />
    </AuthProvider>,
  );

describe('SystemHealth', () => {
  it('shows the totals, the chart data, the worst endpoints and the server', async () => {
    renderPanel();

    expect(await screen.findByText('/api/classes/:id', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Up 2 hours')).toBeInTheDocument();
    expect(screen.getByText('2 errors and 5 warnings in this period')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /errors, .* warnings/ })).toHaveLength(2);
  });

  it('filters the log and expands an entry', async () => {
    renderPanel();
    const user = userEvent.setup();

    const log = await screen.findByRole('region', { name: 'Log' });
    await user.click(within(log).getByRole('button', { name: 'Errors' }));
    expect(api).toHaveBeenCalledWith('/api/monitoring/logs?level=error', expect.anything());

    await user.click(await within(log).findByRole('button', { name: 'Details' }));
    expect(within(log).getByText(/database is on fire/)).toBeInTheDocument();
  });

  it('switches to the last seven days', async () => {
    renderPanel();

    await userEvent.setup().selectOptions(await screen.findByLabelText('Period'), '7d');

    expect(api).toHaveBeenCalledWith('/api/monitoring/summary?range=7d', expect.anything());
  });
});
