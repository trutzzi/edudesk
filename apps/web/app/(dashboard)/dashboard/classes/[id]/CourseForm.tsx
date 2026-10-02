'use client';

import type { FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import { useSend } from '@/lib/useSend';
import type { Person } from '../types';

interface Props {
  classId: string;
  teachers: Person[];
  onSaved: () => void;
  onCancel: () => void;
}

export function CourseForm({ classId, teachers, onSaved, onCancel }: Props) {
  const t = useTranslations('Classes');
  const { send, pending, error } = useSend();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { startDate, endDate, description, ...fields } = Object.fromEntries(new FormData(event.currentTarget));
    // Empty dates are left out, so the backend uses the class's school year
    const result = await send('/api/courses', {
      body: {
        ...fields,
        classId,
        description: description || null,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      },
    });
    if (result.ok) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} aria-label={t('newCourse')} className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('courseName')} name="name" required maxLength={100} autoFocus />
        <SelectField label={t('teacher')} name="teacherId" defaultValue="" required>
          <option value="" disabled>
            {t('chooseTeacher')}
          </option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.firstName} {teacher.lastName}
            </option>
          ))}
        </SelectField>
        <Field label={t('startDate')} name="startDate" type="date" />
        <Field label={t('endDate')} name="endDate" type="date" />
      </div>
      <p className="-mt-2 text-xs text-slate-500">{t('datesHint')}</p>
      <Field label={t('description')} name="description" maxLength={500} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('ghost')}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={pending} className={buttonClass()}>
          {t('createCourse')}
        </button>
      </div>
    </form>
  );
}
