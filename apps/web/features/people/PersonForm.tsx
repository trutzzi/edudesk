'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import type { Therapy } from '@/features/therapies/types';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { EASY_PASSWORD_LENGTH, generatePassword } from '@/lib/generatePassword';
import { PAYMENT_TYPES, type Member } from './types';

interface Props {
  role: 'teacher' | 'student';
  // Editing this person; creating someone new without it
  member?: Member;
  // Rooms a new client can be placed in straight away
  classes: { id: string; name: string }[];
  // With the password just set, so the admin can read it out; null when it didn't change
  onSaved: (password: string | null) => void;
  onCancel: () => void;
}

// Creates or edits a therapist or client. The admin sets their password: they sign in with their phone (or email)
// and it, with no invitation. A new person gets an easy generated password the admin can see, and changing someone's
// password is how the admin helps when they forget it.
export function PersonForm({ role, member, classes, onSaved, onCancel }: Props) {
  const t = useTranslations('PersonForm');
  const tForm = useTranslations('Form');
  const tPayment = useTranslations('PaymentTypes');
  const { send, pending, error } = useSend();
  const therapies = useApi<Therapy[]>(role === 'teacher' ? '/api/therapies' : null);
  const [specializations, setSpecializations] = useState<string[]>(member?.specializations.map(({ id }) => id) ?? []);
  // Shown in plain text on purpose: the admin reads it out or writes it down
  const [password, setPassword] = useState(() => (member ? '' : generatePassword()));
  const isTherapist = role === 'teacher';
  const title = member ? t('editTitle', { name: `${member.firstName} ${member.lastName}` }) : t(isTherapist ? 'newTherapist' : 'newClient');

  function toggle(therapyId: string) {
    setSpecializations((current) =>
      current.includes(therapyId) ? current.filter((value) => value !== therapyId) : [...current, therapyId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const {
      password: _shown,
      classId,
      paymentType,
      ...fields
    } = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const body = {
      ...fields,
      email: fields.email || null,
      // Editing: an empty password keeps the current one
      ...(password && { password }),
      ...(isTherapist ? { specializations } : { paymentType: paymentType || null }),
      ...(!member && { role, ...(classId && { classId }) }),
    };
    const result = member ? await send(`/api/users/${member.id}`, { method: 'PATCH', body }) : await send('/api/users', { body });
    if (result.ok) onSaved(password || null);
  }

  return (
    <form onSubmit={handleSubmit} aria-label={title} className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tForm('firstName')} name="firstName" defaultValue={member?.firstName} required maxLength={100} autoFocus />
        <Field label={tForm('lastName')} name="lastName" defaultValue={member?.lastName} required maxLength={100} />
        <Field
          label={t('phone')}
          name="phone"
          type="tel"
          autoComplete="off"
          placeholder="0722 123 456"
          defaultValue={member?.phone ?? ''}
          // People who joined by invitation may have no phone yet
          required={!member}
        />
        <Field label={t('email')} name="email" type="email" autoComplete="off" defaultValue={member?.email ?? ''} />
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-slate-700">
            {member ? t('newPassword') : tForm('password')}
          </label>
          <div className="flex gap-2">
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={EASY_PASSWORD_LENGTH}
              required={!member}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wider text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <button type="button" onClick={() => setPassword(generatePassword())} className={buttonClass('secondary')}>
              {t('generate')}
            </button>
          </div>
        </div>
        {!isTherapist && (
          <SelectField label={t('paymentType')} name="paymentType" defaultValue={member?.paymentType ?? ''}>
            <option value="">{t('noPaymentType')}</option>
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {tPayment(type)}
              </option>
            ))}
          </SelectField>
        )}
        {!isTherapist && !member && (
          <SelectField label={t('room')} name="classId" defaultValue="">
            <option value="">{t('noRoom')}</option>
            {classes.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <p className="-mt-2 text-xs text-slate-500">{member ? t('passwordKeep') : t('passwordHint')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {(['details', 'notes'] as const).map((field) => (
          <div key={field}>
            <label htmlFor={field} className="mb-1.5 block text-sm font-semibold text-slate-700">
              {t(field)}
            </label>
            <textarea
              id={field}
              name={field}
              rows={3}
              maxLength={2000}
              defaultValue={member?.[field] ?? ''}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        ))}
      </div>

      {isTherapist && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">{t('specializations')}</legend>
          <div className="flex flex-wrap gap-2">
            {(therapies.data ?? []).map(({ id, name }) => (
              <label
                key={id}
                className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${
                  specializations.includes(id) ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'
                }`}
              >
                <input type="checkbox" className="sr-only" checked={specializations.includes(id)} onChange={() => toggle(id)} />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('ghost')}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? t('saving') : t('save')}
        </button>
      </div>
    </form>
  );
}
