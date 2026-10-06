'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import { useAuth, type Session } from '@/features/auth/AuthProvider';
import { useSend } from '@/lib/api/useSend';
import { PendingInvitations } from './PendingInvitations';

// The zones most schools on the platform use; the backend accepts any real time zone
const TIME_ZONES = ['Europe/Bucharest', 'Europe/Chisinau', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'UTC'];

// Shown instead of the dashboard to a school admin whose account has no school yet
export function SchoolSetup() {
  const t = useTranslations('SchoolSetup');
  const { login } = useAuth();
  const { send, pending, error } = useSend();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await send<Session>('/api/schools', { body: Object.fromEntries(new FormData(event.currentTarget)) });
    // The new session's token knows the school, so every page works straight away
    if (result.ok) login(result.data);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* An admin may have been invited to an existing school instead of starting a new one */}
      <PendingInvitations />
      <section aria-labelledby="school-setup-title" className={cardClass('lg')}>
        <h1 id="school-setup-title" className="text-2xl font-bold">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{t('intro')}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormError message={error} />
          <Field label={t('name')} name="name" placeholder={t('namePlaceholder')} required maxLength={255} />
          <div>
            <Field label={t('code')} name="code" required minLength={3} maxLength={20} pattern="[A-Za-z0-9\-]{3,20}" />
            <p className="mt-1 text-xs text-slate-500">{t('codeHint')}</p>
          </div>
          <SelectField label={t('timezone')} name="timezone" defaultValue="Europe/Bucharest">
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace('_', ' ')}
              </option>
            ))}
          </SelectField>
          <button type="submit" disabled={pending} className={buttonClass('primary', 'block')}>
            {pending ? t('creating') : t('create')}
          </button>
        </form>
      </section>
    </div>
  );
}

// Shown to teachers, students and parents who aren't in a school yet: their invitations, or how to get one
export function NoSchool() {
  const t = useTranslations('SchoolSetup');
  const tInvitations = useTranslations('MyInvitations');
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-xl">
      <PendingInvitations
        empty={(checkAgain) => (
          <section className={`text-center ${cardClass('lg')}`}>
            <h1 className="text-xl font-bold">{t('noSchoolTitle')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('noSchoolBody', { email: user?.email ?? '' })}</p>
            <button type="button" onClick={checkAgain} className={`${buttonClass('secondary')} mt-5`}>
              {tInvitations('checkAgain')}
            </button>
          </section>
        )}
      />
    </div>
  );
}
