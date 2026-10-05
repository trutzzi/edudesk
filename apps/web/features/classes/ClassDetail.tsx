'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { FormError } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { colorFor } from '@/lib/colors';
import { ClassCourses } from './ClassCourses';
import { ClassStudents } from './ClassStudents';
import type { ClassDetails, Person } from './types';

export function ClassDetail({ classId }: { classId: string }) {
  const t = useTranslations('Classes');
  const router = useRouter();
  const details = useApi<ClassDetails>(`/api/classes/${classId}`);
  const students = useApi<Person[]>('/api/users?role=student');
  const teachers = useApi<Person[]>('/api/users?role=teacher');
  const { send, pending, error } = useSend();

  const backLink = (
    <Link href="/dashboard/classes" className="text-sm font-semibold text-indigo-600 hover:underline">
      ← {t('back')}
    </Link>
  );

  if (details.error !== undefined) {
    return (
      <>
        {backLink}
        <ErrorAlert>{t('notFound')}</ErrorAlert>
      </>
    );
  }

  const schoolClass = details.data;
  if (!schoolClass) return <Skeleton className="h-64 rounded-2xl bg-slate-200" />;

  async function deleteClass() {
    if (!window.confirm(t('confirmDeleteClass', { name: schoolClass!.name }))) return;
    if ((await send(`/api/classes/${classId}`, { method: 'DELETE' })).ok) router.push('/dashboard/classes');
  }

  return (
    <>
      <div>
        {backLink}
        <div className="mt-3 flex items-center gap-3">
          <span className={`h-4 w-4 rounded-full ${colorFor(schoolClass.id).dot}`} />
          <h1 className="text-3xl font-bold tracking-tight">{schoolClass.name}</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-600">{schoolClass.schoolYear}</span>
          <button type="button" onClick={deleteClass} disabled={pending} className={`${buttonClass('danger', 'sm')} ml-auto`}>
            {t('deleteClass')}
          </button>
        </div>
      </div>

      <FormError message={error} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ClassCourses classId={classId} courses={schoolClass.courses} teachers={teachers.data ?? []} onChanged={details.reload} />
        <ClassStudents classId={classId} students={schoolClass.students} schoolStudents={students.data} onChanged={details.reload} />
      </div>
    </>
  );
}
