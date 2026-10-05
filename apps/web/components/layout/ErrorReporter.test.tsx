import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { reportClientError } from '@/lib/reportError';
import { signIn } from '@/test/signIn';
import { ErrorReporter } from './ErrorReporter';

vi.mock('@/lib/reportError', () => ({ reportClientError: vi.fn() }));

beforeEach(() => {
  signIn({}, 'abc');
});

afterEach(() => {
  vi.mocked(reportClientError).mockReset();
});

describe('ErrorReporter', () => {
  it('reports uncaught errors with the session token', () => {
    render(
      <AuthProvider>
        <ErrorReporter />
      </AuthProvider>,
    );
    const error = new Error('boom');

    window.dispatchEvent(new ErrorEvent('error', { error, message: 'boom' }));

    expect(reportClientError).toHaveBeenCalledWith(error, 'abc');
  });

  it('falls back to the message when the event carries no error', () => {
    render(
      <AuthProvider>
        <ErrorReporter />
      </AuthProvider>,
    );

    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }));

    expect(reportClientError).toHaveBeenCalledWith('Script error.', 'abc');
  });

  it('reports rejected promises nobody handled', () => {
    render(
      <AuthProvider>
        <ErrorReporter />
      </AuthProvider>,
    );
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.assign(event, { reason: 'nope' });

    window.dispatchEvent(event);

    expect(reportClientError).toHaveBeenCalledWith('nope', 'abc');
  });

  it('stops listening once it is removed', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(
      <AuthProvider>
        <ErrorReporter />
      </AuthProvider>,
    );

    unmount();

    expect(remove).toHaveBeenCalledWith('error', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    remove.mockRestore();
  });
});
