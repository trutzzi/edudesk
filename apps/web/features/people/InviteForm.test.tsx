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

const renderForm = () =>
  renderWithIntl(
    <AuthProvider>
      <InviteForm classes={[{ id: 'c9a', name: '9A' }]} onSent={onSent} onCancel={() => {}} />
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

  it('offers a room only for clients, and no parent role', async () => {
    renderForm();
    const user = userEvent.setup();
    expect(screen.queryByLabelText('Room (optional)')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Parent' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Role'), 'student');
    expect(screen.getByLabelText('Room (optional)')).toBeInTheDocument();
  });

  it('lets a teacher invite only students, into one of their classes', async () => {
    renderWithIntl(
      <AuthProvider>
        <InviteForm classes={[{ id: 'c9a', name: '9A' }]} roles={['student']} requireClass onSent={onSent} onCancel={() => {}} />
      </AuthProvider>,
    );
    const user = userEvent.setup();

    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Room')).toBeRequired();

    await user.type(screen.getByLabelText('Email'), 'radu@school.ro');
    await user.selectOptions(screen.getByLabelText('Room'), 'c9a');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(api).toHaveBeenCalledWith('/api/invitations', {
      token: 'abc',
      body: { email: 'radu@school.ro', role: 'student', locale: 'en', classId: 'c9a' },
    });
  });
});
