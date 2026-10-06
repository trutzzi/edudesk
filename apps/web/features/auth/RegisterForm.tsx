'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { api, errorMessage } from '@/lib/api/client';
import { useAuth, type Session } from './AuthProvider';
import { ResendVerification } from './ResendVerification';

const ROLES = ['school_admin', 'teacher', 'parent', 'student'] as const;

export function RegisterForm() {
  const t = useTranslations('Register');
  const tForm = useTranslations('Form');
  const tRoles = useTranslations('Roles');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  // Set once the account exists: the form is replaced by "check your inbox"
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      // The locale picks the language of the confirmation email, when one is sent
      const result = await api<Session | { message: string }>('/api/auth/register', { body: { ...body, locale } });
      // Without email verification the backend signs the user in straight away
      if ('token' in result) login(result);
      else setSentTo(String(body.email));
    } catch (err) {
      setError(errorMessage(err, tErrors));
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div role="status" className="space-y-4 text-center">
        <SectionTitle>{t('checkEmailTitle')}</SectionTitle>
        <p className="text-sm text-slate-600">{t('checkEmailBody', { email: sentTo })}</p>
        <p className="text-xs text-slate-500">{t('noEmail')}</p>
        <ResendVerification email={sentTo} />
      </div>
    );
  }

  return (
    <>
      <FormError message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot: hidden from people and screen readers, so only bots fill it in */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label={tForm('firstName')} name="firstName" autoComplete="given-name" placeholder="John" required />
          <Field label={tForm('lastName')} name="lastName" autoComplete="family-name" placeholder="Doe" required />
        </div>
        <Field label={tForm('email')} name="email" type="email" autoComplete="email" placeholder="john.doe@school.edu" required />
        <SelectField label={tForm('role')} name="role" defaultValue="teacher">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {tRoles(role)}
            </option>
          ))}
        </SelectField>
        <Field
          label={tForm('password')}
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={tForm('passwordHint')}
          minLength={8}
          required
        />
        <button type="submit" disabled={pending} className={buttonClass('primary', 'block')}>
          {pending ? t('submitting') : t('submit')}
        </button>
      </form>
    </>
  );
}
