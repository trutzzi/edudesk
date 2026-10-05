import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signIn } from '@/test/signIn';
import { AuthProvider } from './AuthProvider';
import { RedirectIfSignedIn } from './RedirectIfSignedIn';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const renderGuard = () =>
  render(
    <AuthProvider>
      <RedirectIfSignedIn />
    </AuthProvider>,
  );

afterEach(() => {
  replace.mockReset();
});

describe('RedirectIfSignedIn', () => {
  it('sends an admin to the overview', () => {
    signIn({ role: 'school_admin' });
    renderGuard();

    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('sends everyone else to their timetable', () => {
    signIn({ role: 'student' });
    renderGuard();

    expect(replace).toHaveBeenCalledWith('/dashboard/timetable');
  });

  it('leaves signed-out visitors where they are', () => {
    renderGuard();

    expect(replace).not.toHaveBeenCalled();
  });
});
