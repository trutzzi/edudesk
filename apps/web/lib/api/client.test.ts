import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorMessage } from './client';

const mockFetch = (status: number, body: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('sends a GET request when there is no body', async () => {
    const fetchMock = mockFetch(200, { ok: true });

    await api('/api/health');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:4000/api/health');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });

  it('sends a JSON POST request when there is a body', async () => {
    const fetchMock = mockFetch(200, {});

    await api('/api/auth/login', { body: { email: 'ana@school.edu' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"ana@school.edu"}');
  });

  it('adds the bearer token', async () => {
    const fetchMock = mockFetch(200, {});

    await api('/api/dashboard/stats', { token: 'abc' });

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  it('returns the parsed response', async () => {
    mockFetch(200, { studentsCount: 5 });

    await expect(api('/api/dashboard/stats')).resolves.toEqual({ studentsCount: 5 });
  });

  it('keeps the error code from the server', async () => {
    mockFetch(403, { message: 'Confirm your email', code: 'EMAIL_NOT_VERIFIED' });

    await expect(api('/api/auth/login')).rejects.toMatchObject({ status: 403, code: 'EMAIL_NOT_VERIFIED' });
  });

  it('throws an ApiError with the server message', async () => {
    mockFetch(401, { message: 'Invalid email or password' });

    await expect(api('/api/auth/login')).rejects.toEqual(new ApiError('Invalid email or password', 401));
  });
});

describe('errorMessage', () => {
  const t = (key: string) => `errors.${key}`;

  it('uses the ApiError message', () => {
    expect(errorMessage(new ApiError('Invalid role', 400), t)).toBe('Invalid role');
  });

  it('falls back to a generic message when the server sends none', () => {
    expect(errorMessage(new ApiError('', 500), t)).toBe('errors.generic');
  });

  it('translates errors that carry a known code', () => {
    expect(errorMessage(new ApiError('Too many requests', 429, 'RATE_LIMITED'), t)).toBe('errors.RATE_LIMITED');
  });

  it('falls back to a connection message', () => {
    expect(errorMessage(new TypeError('Failed to fetch'), t)).toBe('errors.network');
  });
});
