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

const therapy = (id: string, name: string) => ({ id, name, coursesCount: 0, therapistsCount: 1 });
const therapies = [therapy('aba', 'ABA'), therapy('kin', 'Kineto'), therapy('logo', 'Logopedie'), therapy('sh', 'Shadow')];
const teachers = [
  { id: 't1', firstName: 'Elena', lastName: 'Popescu', email: 'elena@demo.edu', specializations: [{ id: 'logo', name: 'Logopedie' }] },
  { id: 't2', firstName: 'Dan', lastName: 'Stoica', email: null, specializations: [{ id: 'kin', name: 'Kineto' }] },
];

// The institution's therapies come from the API; saving gets `send`'s answer
const serve = (send: () => Promise<unknown> = async () => ({})) =>
  vi.mocked(api).mockImplementation(async (path) => (path === '/api/therapies' ? therapies : send()));
const onSaved = vi.fn();
const onCancel = vi.fn();

// Waits for the institution's therapies to load
async function renderForm() {
  renderWithIntl(
    <AuthProvider>
      <CourseForm classId="c1" teachers={teachers} taken={['ABA']} onSaved={onSaved} onCancel={onCancel} />
    </AuthProvider>,
  );
  await screen.findByRole('option', { name: 'Logopedie' });
}

beforeEach(() => {
  signIn();
  serve();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onSaved.mockReset();
  onCancel.mockReset();
});

describe('CourseForm', () => {
  it('leaves empty dates out, so the backend uses the school year', async () => {
    await renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Therapy'), 'Logopedie');
    await user.selectOptions(screen.getByLabelText('Therapist'), 't1');
    await user.click(screen.getByRole('button', { name: 'Create therapy' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/api/courses', {
      body: { name: 'Logopedie', teacherId: 't1', classId: 'c1', description: null },
      token: 'token',
    });
  });

  it('sends the dates and description when they are filled in', async () => {
    await renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Therapy'), 'Logopedie');
    await user.selectOptions(screen.getByLabelText('Therapist'), 't1');
    await user.type(screen.getByLabelText('Start date'), '2026-10-01');
    await user.type(screen.getByLabelText('End date'), '2027-01-31');
    await user.type(screen.getByLabelText('Description (optional)'), 'Cells');
    await user.click(screen.getByRole('button', { name: 'Create therapy' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith('/api/courses', {
      body: { name: 'Logopedie', teacherId: 't1', classId: 'c1', description: 'Cells', startDate: '2026-10-01', endDate: '2027-01-31' },
      token: 'token',
    });
  });

  it('shows the error and stays open when saving fails', async () => {
    serve(async () => {
      throw new ApiError('boom', 500);
    });
    await renderForm();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Therapy'), 'Logopedie');
    await user.selectOptions(screen.getByLabelText('Therapist'), 't1');
    await user.click(screen.getByRole('button', { name: 'Create therapy' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("doesn't offer a therapy the room already has", async () => {
    await renderForm();

    expect(screen.getByRole('option', { name: 'ABA' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Kineto' })).toBeEnabled();
  });

  it('offers only the therapists who have the chosen therapy', async () => {
    await renderForm();
    const user = userEvent.setup();
    expect(screen.getByLabelText('Therapist')).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Therapy'), 'Kineto');
    expect(screen.getByRole('option', { name: 'Dan Stoica' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Elena Popescu' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Therapy'), 'Shadow');
    expect(screen.getByLabelText('Therapist')).toBeDisabled();
    expect(screen.getByText('No therapist has this specialization')).toBeInTheDocument();
  });

  it('can be cancelled', async () => {
    await renderForm();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
  });
});
