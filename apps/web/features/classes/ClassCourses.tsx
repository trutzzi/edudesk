'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormError } from '@/components/ui/Field';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useSend } from '@/lib/api/useSend';
import { colorFor } from '@/lib/colors';
import { parseDay } from '@/lib/dates/days';
import { CourseForm } from './CourseForm';
import { ScheduleEditor } from './ScheduleEditor';
import type { ClassCourse, Person } from './types';

interface Props {
  classId: string;
  courses: ClassCourse[];
  teachers: Person[];
  onChanged: () => void;
}

// A class's courses: add one, open a course's weekly schedule, delete one
export function ClassCourses({ classId, courses, teachers, onChanged }: Props) {
  const t = useTranslations('Classes');
  const format = useFormatter();
  const { send, pending, error } = useSend();
  const [adding, setAdding] = useState(false);
  const [openSchedule, setOpenSchedule] = useState<string | null>(null);

  async function deleteCourse(course: ClassCourse) {
    if (!window.confirm(t('confirmDelete', { name: course.name }))) return;
    if ((await send(`/api/courses/${course.id}`, { method: 'DELETE' })).ok) onChanged();
  }

  const courseDates = (course: ClassCourse) =>
    format.dateTimeRange(parseDay(course.startDate), parseDay(course.endDate), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <section aria-labelledby="courses-title" className={`space-y-4 ${cardClass()}`}>
      <div className="flex items-center justify-between">
        <SectionTitle id="courses-title">{t('coursesTitle')}</SectionTitle>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={buttonClass('primary', 'sm')}>
            + {t('newCourse')}
          </button>
        )}
      </div>

      <FormError message={error} />

      {adding && (
        <CourseForm
          classId={classId}
          teachers={teachers}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      )}

      {courses.length === 0 ? (
        <EmptyState>{t('noCourses')}</EmptyState>
      ) : (
        <ul className="divide-y divide-slate-100">
          {courses.map((course) => {
            const open = openSchedule === course.id;
            return (
              <li key={course.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(course.name).dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{course.name}</p>
                    <p className="text-xs text-slate-500">
                      {course.teacherFirstName} {course.teacherLastName} · {courseDates(course)}
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
                      onClick={() => deleteCourse(course)}
                      disabled={pending}
                      aria-label={t('deleteCourse', { name: course.name })}
                      className={buttonClass('danger', 'sm')}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3">
                    <ScheduleEditor courseId={course.id} onSaved={onChanged} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
