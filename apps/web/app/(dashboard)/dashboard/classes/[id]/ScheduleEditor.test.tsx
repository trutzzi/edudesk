import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '@/app/context/AuthContext';
import { api, ApiError } from '@/lib/api';
import { renderWithIntl } from '@/lib/test-utils';
import { ScheduleEditor } from './ScheduleEditor';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  api: vi.fn(),
}));

const monday = { weekday: 1, startTime: '08:00', endTime: '08:50', room: 'Sala 101' };
const onSaved = vi.fn();

const renderEditor = () =>
  renderWithIntl(
    <AuthProvider>
      <ScheduleEditor courseId="c1" onSaved={onSaved} />
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.setItem('edudesk.session', JSON.stringify({ token: 'abc', user: { role: 'school_admin', schoolId: 's1' } }));
  vi.mocked(api).mockImplementation(async (_path, options) => (options?.method === 'PUT' ? [] : [monday]));
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onSaved.mockReset();
});

describe('ScheduleEditor', () => {
  it('starts from the saved schedule and saves added lessons', async () => {
    renderEditor();
    const user = userEvent.setup();

    expect(await screen.findByLabelText('Day 1')).toHaveValue('1');
    await user.click(screen.getByRole('button', { name: '+ Add lesson' }));
    // A new lesson goes on the next day, at the same time and room
    expect(screen.getByLabelText('Day 2')).toHaveValue('2');

    await user.click(screen.getByRole('button', { name: 'Save schedule' }));

    expect(api).toHaveBeenLastCalledWith('/api/courses/c1/lessons', {
      method: 'PUT',
      token: 'abc',
      body: { lessons: [monday, { ...monday, weekday: 2 }] },
    });
    expect(await screen.findByText('Schedule saved.')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalled();
  });

  it('refuses a lesson that ends before it starts, without calling the API', async () => {
    renderEditor();
    const user = userEvent.setup();
    const end = await screen.findByLabelText('End 1');

    await user.clear(end);
    await user.type(end, '07:00');
    await user.click(screen.getByRole('button', { name: 'Save schedule' }));

    expect(screen.getByRole('alert')).toHaveTextContent('end time after its start time');
    expect(api).toHaveBeenCalledTimes(1); // only the initial load
  });

  it('explains a clash in the current language', async () => {
    vi.mocked(api).mockImplementation(async (_path, options) => {
      if (options?.method === 'PUT') throw new ApiError('overlaps', 409, 'LESSON_CLASH');
      return [monday];
    });
    renderEditor();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Save schedule' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('overlaps another lesson of the same teacher or class');
    expect(onSaved).not.toHaveBeenCalled();
  });
});
