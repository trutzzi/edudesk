'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage } from './client';

type Options = { method?: string; body?: unknown };
type Result<T> = { ok: true; data: T } | { ok: false };

// For changes (POST, PUT, PATCH, DELETE): sends with the session token and keeps a translated error message.
// `useApi` is for reading; this is for writing.
export function useSend() {
  const { token } = useAuth();
  const tErrors = useTranslations('Errors');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async <T = unknown>(path: string, options: Options = {}): Promise<Result<T>> => {
      setPending(true);
      setError(null);
      try {
        return { ok: true, data: await api<T>(path, { ...options, token }) };
      } catch (err) {
        setError(errorMessage(err, tErrors));
        return { ok: false };
      } finally {
        setPending(false);
      }
    },
    [token, tErrors],
  );

  return { send, pending, error, clearError: useCallback(() => setError(null), []) };
}
