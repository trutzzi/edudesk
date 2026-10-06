'use client';

import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import type { Therapy } from './types';

// The institution's therapies (specializations): add, rename, delete. Renaming renames the therapies already in rooms;
// a therapy can only be deleted once no room runs it.
export function TherapyList() {
  const t = useTranslations('Therapies');
  const therapies = useApi<Therapy[]>('/api/therapies');
  const { send, pending, error } = useSend();
  const [editing, setEditing] = useState<string | null>(null);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name'));
    if ((await send('/api/therapies', { body: { name } })).ok) {
      form.reset();
      therapies.reload();
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>, therapy: Therapy) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name'));
    if (name.trim() === therapy.name) return setEditing(null);
    if ((await send(`/api/therapies/${therapy.id}`, { method: 'PATCH', body: { name } })).ok) {
      setEditing(null);
      therapies.reload();
    }
  }

  async function remove(therapy: Therapy) {
    if (!window.confirm(t('confirmDelete', { name: therapy.name }))) return;
    if ((await send(`/api/therapies/${therapy.id}`, { method: 'DELETE' })).ok) therapies.reload();
  }

  if (therapies.error !== undefined) return <ErrorAlert>{t('loadError')}</ErrorAlert>;

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form onSubmit={add} aria-label={t('add')} className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          required
          maxLength={100}
          placeholder={t('namePlaceholder')}
          aria-label={t('name')}
          className={`flex-1 ${compactControlClass}`}
        />
        <button type="submit" disabled={pending} className={buttonClass()}>
          + {t('add')}
        </button>
      </form>
      <FormError message={error} />

      {!therapies.data ? (
        <Skeleton className="h-40 rounded-xl bg-slate-100" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {therapies.data.map((therapy) => (
            <li key={therapy.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              {editing === therapy.id ? (
                <form
                  onSubmit={(event) => rename(event, therapy)}
                  aria-label={t('renameLabel', { name: therapy.name })}
                  className="flex flex-1 gap-2"
                >
                  <input
                    name="name"
                    defaultValue={therapy.name}
                    required
                    maxLength={100}
                    autoFocus
                    aria-label={t('name')}
                    className={`min-w-0 flex-1 ${compactControlClass}`}
                  />
                  <button type="submit" disabled={pending} className={buttonClass()}>
                    {t('save')}
                  </button>
                  <button type="button" onClick={() => setEditing(null)} className={buttonClass('ghost')}>
                    {t('cancel')}
                  </button>
                </form>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{therapy.name}</p>
                    <p className="text-xs text-slate-500">
                      {t('usage', { courses: therapy.coursesCount, therapists: therapy.therapistsCount })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditing(therapy.id)}
                    aria-label={t('renameLabel', { name: therapy.name })}
                    className="text-sm font-semibold text-indigo-600 hover:underline"
                  >
                    {t('rename')}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(therapy)}
                    disabled={pending || therapy.coursesCount > 0}
                    title={therapy.coursesCount > 0 ? t('inUse') : undefined}
                    aria-label={t('deleteLabel', { name: therapy.name })}
                    className="text-sm font-semibold text-slate-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-slate-400"
                  >
                    {t('delete')}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
