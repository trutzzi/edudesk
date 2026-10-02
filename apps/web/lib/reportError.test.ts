import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, resetReportedErrors } from './reportError';

const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

beforeEach(() => {
  resetReportedErrors();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockClear();
  vi.unstubAllGlobals();
});

describe('reportClientError', () => {
  it('sends the error, its stack and the page, with the session when there is one', () => {
    reportClientError(new TypeError('x is undefined'), 'abc');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/api/monitoring/client-errors');
    expect(init.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(init.body)).toMatchObject({ message: 'TypeError: x is undefined', url: window.location.href });
  });

  it('reports each message once, and at most five per page', () => {
    reportClientError(new Error('same'));
    reportClientError(new Error('same'));
    for (let i = 0; i < 10; i++) reportClientError(new Error(`error ${i}`));

    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
