import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api, ApiError } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { ClassStudents } from './ClassStudents';
import type { Person } from './types';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const ioana: Person = { id: 's1', firstName: 'Ioana', lastName: 'Stan', email: 'ioana@demo.edu' };
const radu: Person = { id: 's2', firstName: 'Radu', lastName: 'Marin', email: 'radu@demo.edu' };
const onChanged = vi.fn();

const renderStudents = (students: Person[], schoolStudents: Person[] | undefined) =>
  renderWithIntl(
    <AuthProvider>
      <ClassStudents classId="c1" students={students} schoolStudents={schoolStudents} onChanged={onChanged} />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn();
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onChanged.mockReset();
});

describe('ClassStudents', () => {
  it('offers only the students who are not in the class yet', () => {
    renderStudents([ioana], [ioana, radu]);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Choose a student…', 'Marin Radu']);
  });

  it('adds the chosen student', async () => {
    vi.mocked(api).mockResolvedValue({});
    renderStudents([ioana], [ioana, radu]);
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Add student'), 's2');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/classes/c1/students', { body: { studentId: 's2' }, token: 'token' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('removes a student from the class', async () => {
    vi.mocked(api).mockResolvedValue(undefined);
    renderStudents([ioana], [ioana]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove Ioana Stan from the class' }));

    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/classes/c1/students/s1', { method: 'DELETE', token: 'token' }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('says when everyone is already in the class', () => {
    renderStudents([ioana], [ioana]);

    expect(screen.getByText('Every student in the school is already in this class.')).toBeInTheDocument();
  });

  it('says nothing about the picker while the school students load', () => {
    renderStudents([], undefined);

    expect(screen.getByText('No students in this class yet.')).toBeInTheDocument();
    expect(screen.queryByText('Every student in the school is already in this class.')).not.toBeInTheDocument();
  });

  it('shows the error when adding fails', async () => {
    vi.mocked(api).mockRejectedValue(new ApiError('boom', 500));
    renderStudents([], [radu]);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByLabelText('Add student'), 's2');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
