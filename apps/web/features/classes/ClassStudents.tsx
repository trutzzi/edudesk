'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PersonList } from '@/components/PersonList';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { useSend } from '@/lib/api/useSend';
import type { Person } from './types';

interface Props {
  classId: string;
  students: Person[];
  // Every student in the school, for the picker; undefined while loading
  schoolStudents: Person[] | undefined;
  onChanged: () => void;
}

// A class's students: add one from the school, remove one
export function ClassStudents({ classId, students, schoolStudents, onChanged }: Props) {
  const t = useTranslations('Classes');
  const { send, pending, error } = useSend();
  const [studentToAdd, setStudentToAdd] = useState('');

  const inClass = new Set(students.map((student) => student.id));
  const addable = (schoolStudents ?? []).filter((student) => !inClass.has(student.id));

  async function addStudent() {
    if (!studentToAdd) return;
    if ((await send(`/api/classes/${classId}/students`, { body: { studentId: studentToAdd } })).ok) {
      setStudentToAdd('');
      onChanged();
    }
  }

  async function removeStudent(studentId: string) {
    if ((await send(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' })).ok) onChanged();
  }

  return (
    <section aria-labelledby="students-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="students-title" className="text-lg font-bold">
        {t('studentsTitle')} <span className="text-sm font-medium text-slate-400">({students.length})</span>
      </h2>

      <FormError message={error} />

      {addable.length > 0 ? (
        <div className="flex gap-2">
          <select
            aria-label={t('addStudent')}
            value={studentToAdd}
            onChange={(event) => setStudentToAdd(event.target.value)}
            className={`min-w-0 flex-1 ${compactControlClass}`}
          >
            <option value="">{t('chooseStudent')}</option>
            {addable.map((student) => (
              <option key={student.id} value={student.id}>
                {student.lastName} {student.firstName}
              </option>
            ))}
          </select>
          <button type="button" onClick={addStudent} disabled={!studentToAdd || pending} className={buttonClass('primary', 'sm')}>
            {t('add')}
          </button>
        </div>
      ) : (
        schoolStudents && <p className="text-xs text-slate-500">{t('allAdded')}</p>
      )}

      {students.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">{t('noStudents')}</p>
      ) : (
        <PersonList
          people={students}
          action={(student) => ({
            label: t('remove'),
            ariaLabel: t('removeStudent', { name: `${student.firstName} ${student.lastName}` }),
            onClick: () => removeStudent(student.id),
            disabled: pending,
          })}
        />
      )}
    </section>
  );
}
