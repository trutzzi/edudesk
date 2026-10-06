'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessNote } from '@/components/ui/SuccessNote';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Member } from '@/features/people/types';
import type { Therapy } from '@/features/therapies/types';
import { setLocale } from '@/i18n/actions';
import { locales, type Locale } from '@/i18n/config';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';

const textareaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500';
const cardClass = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';

// The signed-in person's own profile: their details, language, notes, the therapies they can run (therapists),
// and their password
export function Profile() {
  const t = useTranslations('Profile');
  const tForm = useTranslations('Form');
  const tLocale = useTranslations('LocaleSwitcher');
  const currentLocale = useLocale();
  const { user, token, login } = useAuth();
  const isTherapist = user?.role === 'teacher';
  const profile = useApi<Member>('/api/me');
  const therapies = useApi<Therapy[]>(isTherapist ? '/api/therapies' : null);
  const details = useSend();
  const language = useSend();
  const password = useSend();
  const [, startTransition] = useTransition();
  const [specializations, setSpecializations] = useState<string[] | null>(null);
  const [savedDetails, setSavedDetails] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);

  if (profile.error !== undefined) return <ErrorAlert>{t('loadError')}</ErrorAlert>;
  if (!profile.data || !user || !token) return <Skeleton className="h-96 rounded-2xl bg-slate-200" />;
  const me = profile.data;
  const chosen = specializations ?? me.specializations.map(({ id }) => id);

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedDetails(false);
    const fields = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body = { ...fields, email: fields.email || null, ...(isTherapist && { specializations: chosen }) };
    const result = await details.send<Member>('/api/me', { method: 'PATCH', body });
    if (!result.ok) return;
    setSavedDetails(true);
    // The header shows the name from the session
    login({ token: token!, user: { ...user!, firstName: result.data.firstName, lastName: result.data.lastName } });
    profile.reload();
  }

  async function chooseLanguage(locale: Locale) {
    const result = await language.send('/api/me', { method: 'PATCH', body: { locale } });
    if (!result.ok) return;
    // Remembered in the session too, so this device and the next sign-in agree
    login({ token: token!, user: { ...user!, locale } });
    startTransition(() => setLocale(locale));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedPassword(false);
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if ((await password.send('/api/me/password', { method: 'PUT', body })).ok) {
      form.reset();
      setSavedPassword(true);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <form onSubmit={saveDetails} aria-label={t('detailsTitle')} className={cardClass}>
        <h2 className="text-lg font-bold">{t('detailsTitle')}</h2>
        <FormError message={details.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tForm('firstName')} name="firstName" defaultValue={me.firstName} required maxLength={100} />
          <Field label={tForm('lastName')} name="lastName" defaultValue={me.lastName} required maxLength={100} />
          <Field label={t('phone')} name="phone" type="tel" defaultValue={me.phone ?? ''} placeholder="0722 123 456" />
          <Field label={t('email')} name="email" type="email" defaultValue={me.email ?? ''} />
        </div>
        <div>
          <label htmlFor="details" className="mb-1.5 block text-sm font-semibold text-slate-700">
            {t('details')}
          </label>
          <textarea
            id="details"
            name="details"
            rows={3}
            maxLength={2000}
            defaultValue={me.details ?? ''}
            placeholder={t('detailsPlaceholder')}
            className={textareaClass}
          />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-semibold text-slate-700">
            {t('notes')}
          </label>
          <textarea id="notes" name="notes" rows={4} maxLength={2000} defaultValue={me.notes ?? ''} className={textareaClass} />
          <p className="mt-1 text-xs text-slate-500">{t('notesHint')}</p>
        </div>

        {isTherapist && (
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-slate-700">{t('skills')}</legend>
            <div className="flex flex-wrap gap-2">
              {(therapies.data ?? []).map(({ id, name }) => (
                <label
                  key={id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                    chosen.includes(id) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={chosen.includes(id)}
                    onChange={() => setSpecializations(chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id])}
                  />
                  {name}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('skillsHint')}</p>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={details.pending} className={buttonClass()}>
            {details.pending ? t('saving') : t('save')}
          </button>
          {savedDetails && <SuccessNote>{t('saved')}</SuccessNote>}
        </div>
      </form>

      <div className="space-y-6">
        <section aria-labelledby="language-title" className={cardClass}>
          <h2 id="language-title" className="text-lg font-bold">
            {t('language')}
          </h2>
          <FormError message={language.error} />
          <SegmentedControl<Locale>
            label={t('language')}
            value={me.locale ?? currentLocale}
            disabled={language.pending}
            onChange={chooseLanguage}
            segments={locales.map((locale) => ({ value: locale, label: tLocale(locale), lang: locale }))}
          />
          <p className="text-xs text-slate-500">{t('languageHint')}</p>
        </section>

        <form onSubmit={changePassword} aria-label={t('passwordTitle')} className={cardClass}>
          <h2 className="text-lg font-bold">{t('passwordTitle')}</h2>
          <FormError message={password.error} />
          <Field label={t('currentPassword')} name="currentPassword" type="password" autoComplete="current-password" required />
          <Field label={t('newPassword')} name="newPassword" type="password" autoComplete="new-password" minLength={6} required />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={password.pending} className={buttonClass('secondary')}>
              {t('changePassword')}
            </button>
            {savedPassword && <SuccessNote>{t('passwordChanged')}</SuccessNote>}
          </div>
        </form>
      </div>
    </div>
  );
}
