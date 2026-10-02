'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { reportClientError } from '@/lib/reportError';

// Reports errors nothing else caught: uncaught exceptions and rejected promises anywhere in the app
export function ErrorReporter() {
  const { token } = useAuth();

  useEffect(() => {
    const onError = (event: ErrorEvent) => reportClientError(event.error ?? event.message, token);
    const onRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason, token);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [token]);

  return null;
}
