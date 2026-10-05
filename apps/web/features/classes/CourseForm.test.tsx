import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { CourseForm } from './CourseForm';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const teachers = [{ id: 't1', firstName: 'Elena', lastName: 'Popescu', email: 'elena@demo.edu' }];
const onSaved = vi.fn();
const onCancel = vi.fn();

const renderForm = () =>
  renderWithIntl(
    <AuthProvider>
      <CourseForm classId="c1" teachers={teachers} onSaved={onSaved} onCancel={onCancel} />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onSaved.mockReset();
  onCancel.mockReset();
});

describe('CourseForm', () => {
  it('leaves empty dates out, so the backend uses the school year', async () => {
    vi.mocked(api).mockResolvedValue({});
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Course name'), 'Biology');
    await user.selectOptions(screen.getByLabelText('Teacher'), 't1');
    await user.click(screen.getByRole('button', { name: 'Create course' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/api/courses', {
      body: { name: 'Biology', teacherId: 't1', classId: 'c1', description: null },
      token: 'token',
    });
  });

  it('sends the dates and description when they are filled in', async () => {
    vi.mocked(api).mockResolvedValue({});
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Course name'), 'Biology');
    await user.selectOptions(screen.getByLabelText('Teacher'), 't1');
    await user.type(screen.getByLabelText('Start date'), '2026-10-01');
    await user.type(screen.getByLabelText('End date'), '2027-01-31');
    await user.type(screen.getByLabelText('Description (optional)'), 'Cells');
    await user.click(screen.getByRole('button', { name: 'Create course' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/api/courses', {
      body: { name: 'Biology', teacherId: 't1', classId: 'c1', description: 'Cells', startDate: '2026-10-01', endDate: '2027-01-31' },
      token: 'token',
    });
  });

  it('shows the error and stays open when saving fails', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Course name'), 'Biology');
    await user.selectOptions(screen.getByLabelText('Teacher'), 't1');
    await user.click(screen.getByRole('button', { name: 'Create course' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('can be cancelled', async () => {
    renderForm();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
