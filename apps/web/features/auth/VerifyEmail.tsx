'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { FormError } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { api, errorMessage } from '@/lib/api/client';
import { useAuth, type Session } from './AuthProvider';

export function VerifyEmail({ token }: { token: string | null }) {
  const t = useTranslations('Verify');
  const tErrors = useTranslations('Errors');
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  // A link works only once. React runs effects twice in development, so make sure it's sent once.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;

    // On success, signing in lets the auth layout redirect to the dashboard
    api<Session>('/api/auth/verify-email', { body: { token } })
      .then(login)
      .catch((err) => setError(errorMessage(err, tErrors)));
  }, [token, login, tErrors]);

  if (token && !error) {
    return (
      <p role="status" className="flex items-center justify-center gap-3 text-sm text-slate-600">
        <Spinner />
        {t('verifying')}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error ?? t('missingToken')} />
      <Link href="/login" className={buttonClass('secondary', 'block')}>
        {t('backToSignIn')}
      </Link>
    </div>
  );
}
