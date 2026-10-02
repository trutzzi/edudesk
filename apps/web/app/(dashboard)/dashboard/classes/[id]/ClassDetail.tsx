'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { colorFor } from '@/lib/colors';
import { parseDay } from '@/lib/timeline';
import { useApi } from '@/lib/useApi';
import { useSend } from '@/lib/useSend';
import type { ClassDetails, Person } from '../types';
import { CourseForm } from './CourseForm';
import { ScheduleEditor } from './ScheduleEditor';
import { ErrorAlert } from '@/components/ui/Alert';

export function ClassDetail({ classId }: { classId: string }) {
  const t = useTranslations('Classes');
  const format = useFormatter();
  const details = useApi<ClassDetails>(`/api/classes/${classId}`);
  const students = useApi<Person[]>('/api/users?role=student');
  const teachers = useApi<Person[]>('/api/users?role=teacher');
  const { send, pending, error } = useSend();
  const router = useRouter();

  const [studentToAdd, setStudentToAdd] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [openSchedule, setOpenSchedule] = useState<string | null>(null);

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
  if (!schoolClass) {
    return <div aria-hidden className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  const inClass = new Set(schoolClass.students.map((student) => student.id));
  const addable = (students.data ?? []).filter((student) => !inClass.has(student.id));

  async function addStudent() {
    if (!studentToAdd) return;
    const result = await send(`/api/classes/${classId}/students`, { body: { studentId: studentToAdd } });
    if (result.ok) {
      setStudentToAdd('');
      details.reload();
    }
  }

  async function removeStudent(studentId: string) {
    if ((await send(`/api/classes/${classId}/students/${studentId}`, { method: 'DELETE' })).ok) details.reload();
  }

  async function deleteClass() {
    if (!window.confirm(t('confirmDeleteClass', { name: schoolClass!.name }))) return;
    if ((await send(`/api/classes/${classId}`, { method: 'DELETE' })).ok) router.push('/dashboard/classes');
  }

  async function deleteCourse(courseId: string, name: string) {
    if (!window.confirm(t('confirmDelete', { name }))) return;
    if ((await send(`/api/courses/${courseId}`, { method: 'DELETE' })).ok) details.reload();
  }

  const courseDates = (startDate: string, endDate: string) =>
    format.dateTimeRange(parseDay(startDate), parseDay(endDate), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <>
      <div>
        {backLink}
        <div className="mt-3 flex items-center gap-3">
          <span className={`h-4 w-4 rounded-full ${colorFor(schoolClass.id).dot}`} />
          <h1 className="text-3xl font-bold tracking-tight">{schoolClass.name}</h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-600">{schoolClass.schoolYear}</span>
          <button
            type="button"
            onClick={deleteClass}
            disabled={pending}
            className={`${buttonClass('ghost', 'sm')} ml-auto text-red-600 hover:bg-red-50 hover:text-red-700`}
          >
            {t('deleteClass')}
          </button>
        </div>
      </div>

      <FormError message={error} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Courses */}
        <section aria-labelledby="courses-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 id="courses-title" className="text-lg font-bold">
              {t('coursesTitle')}
            </h2>
            {!addingCourse && (
              <button type="button" onClick={() => setAddingCourse(true)} className={buttonClass('primary', 'sm')}>
                + {t('newCourse')}
              </button>
            )}
          </div>

          {addingCourse && (
            <CourseForm
              classId={classId}
              teachers={teachers.data ?? []}
              onCancel={() => setAddingCourse(false)}
              onSaved={() => {
                setAddingCourse(false);
                details.reload();
              }}
            />
          )}

          {schoolClass.courses.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('noCourses')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schoolClass.courses.map((course) => {
                const open = openSchedule === course.id;
                return (
                  <li key={course.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(course.name).dot}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{course.name}</p>
                        <p className="text-xs text-slate-500">
                          {course.teacherFirstName} {course.teacherLastName} · {courseDates(course.startDate, course.endDate)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          course.lessonsCount === 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t('lessonsPerWeek', { count: course.lessonsCount })}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setOpenSchedule(open ? null : course.id)}
                          aria-expanded={open}
                          className={buttonClass('secondary', 'sm')}
                        >
                          {open ? t('hideSchedule') : t('schedule')}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCourse(course.id, course.name)}
                          disabled={pending}
                          aria-label={t('deleteCourse', { name: course.name })}
                          className={`${buttonClass('ghost', 'sm')} text-red-600 hover:bg-red-50 hover:text-red-700`}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                    {open && (
                      <div className="mt-3">
                        <ScheduleEditor courseId={course.id} onSaved={details.reload} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Students */}
        <section aria-labelledby="students-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="students-title" className="text-lg font-bold">
            {t('studentsTitle')}{' '}
            <span className="text-sm font-medium text-slate-400">({schoolClass.students.length})</span>
          </h2>

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
            students.data && <p className="text-xs text-slate-500">{t('allAdded')}</p>
          )}

          {schoolClass.students.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('noStudents')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schoolClass.students.map((student) => (
                <li key={student.id} className="flex items-center gap-3 py-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                    {student.firstName[0]}
                    {student.lastName[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="truncate text-xs text-slate-500">{student.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStudent(student.id)}
                    disabled={pending}
                    aria-label={t('removeStudent', { name: `${student.firstName} ${student.lastName}` })}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
