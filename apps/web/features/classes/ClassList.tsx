'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { Field, FormError } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { colorFor } from '@/lib/colors';
import { nowIn } from '@/lib/dates/clock';
import { browserTimeZone } from '@/lib/useNow';
import { schoolYearOf, type ClassSummary } from './types';

export function ClassList() {
  const t = useTranslations('Classes');
  const classes = useApi<ClassSummary[]>('/api/classes');
  const { send, pending, error } = useSend();
  const [adding, setAdding] = useState(false);
  const [defaultYear] = useState(() => schoolYearOf(nowIn(browserTimeZone()).day));

  async function createClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const result = await send('/api/classes', { body: Object.fromEntries(new FormData(form)) });
    if (result.ok) {
      form.reset();
      setAdding(false);
      classes.reload();
    }
  }

  if (classes.error !== undefined) {
    return <ErrorAlert>{t('loadError')}</ErrorAlert>;
  }

  return (
    <div className="space-y-6">
      {adding ? (
        <form onSubmit={createClass} aria-label={t('newClass')} className={`flex flex-wrap items-end gap-4 ${cardClass()}`}>
          <div className="w-full">
            <FormError message={error} />
          </div>
          <div className="w-full sm:w-40">
            <Field label={t('name')} name="name" placeholder={t('namePlaceholder')} required maxLength={50} autoFocus />
          </div>
          <div className="w-full sm:w-40">
            <Field label={t('schoolYear')} name="schoolYear" defaultValue={defaultYear} pattern="\d{4}-\d{4}" required />
          </div>
          <div className="flex w-full justify-end gap-2 sm:ml-auto sm:w-auto">
            <button type="button" onClick={() => setAdding(false)} className={buttonClass('ghost')}>
              {t('cancel')}
            </button>
            <button type="submit" disabled={pending} className={buttonClass()}>
              {pending ? t('creating') : t('create')}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={buttonClass()}>
          + {t('newClass')}
        </button>
      )}

      {classes.loading && !classes.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : classes.data?.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {classes.data?.map((schoolClass) => (
            <li key={schoolClass.id}>
              <Link
                href={`/dashboard/classes/${schoolClass.id}`}
                className={`group block transition hover:border-indigo-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none ${cardClass()}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`h-3 w-3 rounded-full ${colorFor(schoolClass.id).dot}`} />
                  <span className="text-xs font-medium text-slate-400">{schoolClass.schoolYear}</span>
                </div>
                <p className="mt-3 text-3xl font-extrabold tracking-tight">{schoolClass.name}</p>
                <p className="mt-1 flex items-center justify-between text-sm text-slate-500">
                  {t('students', { count: schoolClass.studentsCount })}
                  <span className="font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">{t('open')} →</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
