import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api/client';
import { renderWithIntl } from '@/test/renderWithIntl';
import { signIn } from '@/test/signIn';
import { InviteForm } from './InviteForm';

vi.mock('@/lib/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api/client')>()),
  api: vi.fn(),
}));

const onSent = vi.fn();
const ioana = { id: 's1', firstName: 'Ioana', lastName: 'Stan', email: 'ioana@demo.edu', role: 'student' as const };

const renderForm = () =>
  renderWithIntl(
    <AuthProvider>
      <InviteForm classes={[{ id: 'c9a', name: '9A' }]} students={[ioana]} onSent={onSent} onCancel={() => {}} />
    </AuthProvider>,
  );

beforeEach(() => {
  signIn({ role: 'school_admin' }, 'abc');
  vi.mocked(api).mockResolvedValue({ id: 'i1' });
});

afterEach(() => {
  vi.mocked(api).mockReset();
  onSent.mockReset();
});

describe('InviteForm', () => {
  it('invites a teacher', async () => {
    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'elena@school.ro');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(api).toHaveBeenCalledWith('/api/invitations', {
      token: 'abc',
      body: { email: 'elena@school.ro', role: 'teacher', locale: 'en' },
    });
    expect(onSent).toHaveBeenCalledWith('elena@school.ro');
  });

  it('offers a class only for students and a child only for parents', async () => {
    renderForm();
    const user = userEvent.setup();
    expect(screen.queryByLabelText('Class (optional)')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Role'), 'student');
    expect(screen.getByLabelText('Class (optional)')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Role'), 'parent');
    expect(screen.queryByLabelText('Class (optional)')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'mama@school.ro');
    await user.selectOptions(screen.getByLabelText('Their child (optional)'), 's1');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(api).toHaveBeenCalledWith('/api/invitations', {
      token: 'abc',
      body: { email: 'mama@school.ro', role: 'parent', locale: 'en', studentId: 's1' },
    });
  });

  it('lets a teacher invite only students, into one of their classes', async () => {
    renderWithIntl(
      <AuthProvider>
        <InviteForm
          classes={[{ id: 'c9a', name: '9A' }]}
          students={[]}
          roles={['student']}
          requireClass
          onSent={onSent}
          onCancel={() => {}}
        />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Class')).toBeRequired();

    await user.type(screen.getByLabelText('Email'), 'radu@school.ro');
    await user.selectOptions(screen.getByLabelText('Class'), 'c9a');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(api).toHaveBeenCalledWith('/api/invitations', {
      token: 'abc',
      body: { email: 'radu@school.ro', role: 'student', locale: 'en', classId: 'c9a' },
    });
  });
});
