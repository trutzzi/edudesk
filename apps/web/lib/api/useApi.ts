'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, ApiError } from './client';

interface State<T> {
  key: string;
  data?: T;
  error?: unknown;
}

// GETs `path` with the session token. Pass null to skip. While a new path loads, the last data stays
// available, so views don't flash empty between pages.
export function useApi<T>(path: string | null) {
  const { token, logout } = useAuth();
  const [state, setState] = useState<State<T> | null>(null);
  const [version, setVersion] = useState(0);
  const key = `${path}#${version}`;

  useEffect(() => {
    if (!token || !path) return;
    const controller = new AbortController();

    api<T>(path, { token, signal: controller.signal })
      .then((data) => setState({ key, data }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        // Only an expired session signs out; a 403 just means this page isn't for this user
        if (error instanceof ApiError && error.status === 401) logout();
        else setState((previous) => ({ key, data: previous?.data, error }));
      });

    return () => controller.abort();
  }, [path, key, token, logout]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const current = state?.key === key;

  return {
    data: path ? state?.data : undefined,
    error: current ? state?.error : undefined,
    loading: Boolean(path) && !current,
    reload,
  };
}
