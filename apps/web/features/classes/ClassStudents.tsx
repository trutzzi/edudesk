'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PersonList } from '@/components/PersonList';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { SectionTitle } from '@/components/ui/SectionTitle';
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
    <section aria-labelledby="students-title" className={`space-y-4 ${cardClass()}`}>
      <SectionTitle id="students-title" count={students.length}>
        {t('studentsTitle')}
      </SectionTitle>

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
        <EmptyState>{t('noStudents')}</EmptyState>
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
