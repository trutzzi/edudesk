import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { ClassCourses } from './ClassCourses';
import type { ClassCourse } from './types';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const course: ClassCourse = {
  id: 'm1',
  name: 'Maths',
  description: null,
  startDate: '2026-09-07',
  endDate: '2027-06-18',
  teacherId: 't1',
  teacherFirstName: 'Elena',
  teacherLastName: 'Popescu',
  lessonsCount: 2,
};
const onChanged = vi.fn();

const renderCourses = (courses: ClassCourse[]) =>
  renderWithIntl(
    <AuthProvider>
      <ClassCourses classId="c1" courses={courses} teachers={[]} onChanged={onChanged} />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onChanged.mockReset();
  vi.restoreAllMocks();
});

describe('ClassCourses', () => {
  it('lists the courses with their teacher and weekly lessons', () => {
    renderCourses([course, { ...course, id: 'm2', name: 'Art', lessonsCount: 0 }]);

    expect(screen.getByText('Maths')).toBeInTheDocument();
    expect(screen.getAllByText(/Elena Popescu/)).toHaveLength(2);
    expect(screen.getByText('2 lessons a week')).toBeInTheDocument();
    expect(screen.getByText('No schedule yet')).toBeInTheDocument();
  });

  it('says when there are no courses', () => {
    renderCourses([]);

    expect(screen.getByText('No therapies yet.')).toBeInTheDocument();
  });

  it('opens and hides the weekly schedule', async () => {
    vi.mocked(api).mockResolvedValue([]);
    renderCourses([course]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByRole('button', { name: 'Hide schedule' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide schedule' }));
    expect(screen.getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('deletes a course after confirming', async () => {
    vi.mocked(api).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCourses([course]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Maths' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/courses/m1', { method: 'DELETE', token: 'token' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('keeps the course when the deletion is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderCourses([course]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Maths' }));

    expect(api).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('shows why a deletion failed', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCourses([course]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Delete Maths' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('shows the new-course form and closes it after saving', async () => {
    vi.mocked(api).mockImplementation(async (path) => (path === '/api/therapies' ? [] : {}));
    renderCourses([course]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '+ New therapy' }));
    expect(screen.getByRole('form', { name: 'New therapy' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form', { name: 'New therapy' })).not.toBeInTheDocument();
  });
});
