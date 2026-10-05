import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AuthProvider, useAuth, type Session } from './AuthProvider';

const session: Session = {
  token: 'abc',
  user: { id: 'u1', email: 'ana@school.edu', firstName: 'Ana', lastName: 'Pop', role: 'teacher', schoolId: null },
};

function Consumer() {
  const { user, token, login, logout } = useAuth();
  return (
    <>
      <p>{user ? `${user.firstName} (${token})` : 'signed out'}</p>
      <button onClick={() => login(session)}>Log in</button>
      <button onClick={logout}>Log out</button>
    </>
  );
}

const renderWithProvider = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );

describe('AuthContext', () => {
  it('starts signed out', () => {
    renderWithProvider();

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('signs in and saves the session', async () => {
    renderWithProvider();

    await userEvent.click(screen.getByText('Log in'));

    expect(screen.getByText('Ana (abc)')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('edudesk.session')!)).toEqual(session);
  });

  it('signs out and clears the session', async () => {
    renderWithProvider();

    await userEvent.click(screen.getByText('Log in'));
    await userEvent.click(screen.getByText('Log out'));

    expect(screen.getByText('signed out')).toBeInTheDocument();
    expect(localStorage.getItem('edudesk.session')).toBeNull();
  });

  it('restores a saved session', () => {
    localStorage.setItem('edudesk.session', JSON.stringify(session));

    renderWithProvider();

    expect(screen.getByText('Ana (abc)')).toBeInTheDocument();
  });

  it('ignores a corrupted session', () => {
    localStorage.setItem('edudesk.session', '{not json');

    renderWithProvider();

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within an AuthProvider');
  });
});
