'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api/client';
import { EVENT_KINDS } from '@/lib/colors';

interface Props {
  classes: { id: string; name: string }[];
  defaultDate: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function EventForm({ classes, defaultDate, onSaved, onCancel }: Props) {
  const t = useTranslations('Calendar');
  const tErrors = useTranslations('Errors');
  const { token } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(defaultDate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { classId, ...fields } = Object.fromEntries(new FormData(event.currentTarget));

    try {
      await api('/api/events', { token, body: { ...fields, classId: classId || null } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, tErrors));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={t('addEvent')} className={`space-y-4 ${cardClass()}`}>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2">
          <Field label={t('eventTitle')} name="title" required maxLength={150} />
        </div>
        <SelectField label={t('kind')} name="kind" defaultValue="exam">
          {EVENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </SelectField>
        <Field
          label={t('start')}
          name="startDate"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
          required
        />
        <Field label={t('end')} name="endDate" type="date" min={startDate} defaultValue={defaultDate} required />
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-48">
          <SelectField label={t('class')} name="classId" defaultValue="">
            <option value="">{t('wholeSchool')}</option>
            {classes.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex w-full justify-end gap-2 sm:ml-auto sm:w-auto">
          <button type="button" onClick={onCancel} className={buttonClass('ghost')}>
            {t('cancel')}
          </button>
          <button type="submit" disabled={pending} className={buttonClass()}>
            {pending ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}
