'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth, type Session } from '@/app/context/AuthContext';
import { api, ApiError, errorMessage } from '@/lib/api';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/Field';
import { ResendVerification } from '@/components/ResendVerification';

export function LoginForm() {
  const t = useTranslations('Login');
  const tCommon = useTranslations('Common');
  const tForm = useTranslations('Form');
  const tErrors = useTranslations('Errors');
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the password was right but the email isn't confirmed yet
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setUnverifiedEmail(null);
    const body = Object.fromEntries(new FormData(event.currentTarget));

    try {
      login(await api<Session>('/api/auth/login', { body }));
    } catch (err) {
      setError(errorMessage(err, tErrors));
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') setUnverifiedEmail(String(body.email));
      setPending(false);
    }
  }

  return (
    <>
      <FormError message={error} />
      {unverifiedEmail && (
        <div className="mb-6">
          <ResendVerification email={unverifiedEmail} />
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={tForm('email')} name="email" type="email" autoComplete="email" placeholder="name@school.edu" required />
        <Field
          label={tForm('password')}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
        <button type="submit" disabled={pending} className={buttonClass('primary', 'block')}>
          {pending ? t('submitting') : tCommon('signIn')}
        </button>
      </form>
    </>
  );
}
