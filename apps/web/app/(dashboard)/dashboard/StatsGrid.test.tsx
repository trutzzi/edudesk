import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { AuthProvider } from '@/app/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { StatsGrid } from './StatsGrid';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const renderGrid = (locale?: 'en' | 'ro') =>
  renderWithIntl(
    <AuthProvider>
      <StatsGrid />
    </AuthProvider>,
    locale,
  );

beforeEach(() => {
  localStorage.setItem('edudesk.session', JSON.stringify({ token: 'abc', user: { firstName: 'Ana' } }));
});

afterEach(() => {
  vi.mocked(api).mockReset();
});

describe('StatsGrid', () => {
  it('shows the stats from the API', async () => {
    vi.mocked(api).mockResolvedValue({ studentsCount: 1200, teachersCount: 45, adminsCount: 3, classesCount: 0 });

    renderGrid();

    expect(await screen.findByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/api/dashboard/stats', expect.objectContaining({ token: 'abc' }));
  });

  it('uses Romanian labels and number format', async () => {
    vi.mocked(api).mockResolvedValue({ studentsCount: 1200, teachersCount: 45, adminsCount: 3, classesCount: 0 });

    renderGrid('ro');

    expect(await screen.findByText('1.200')).toBeInTheDocument();
    expect(screen.getByText('Elevi')).toBeInTheDocument();
  });

  it('shows an error when loading fails', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Internal server error', 500));

    renderGrid();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load statistics");
  });

  it('signs out when the session has expired', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('Session expired', 401));

    renderGrid();

    await waitFor(() => expect(localStorage.getItem('edudesk.session')).toBeNull());
  });
});
