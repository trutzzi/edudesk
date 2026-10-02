'use client';

import { useTranslations } from 'next-intl';
import { colorFor } from '@/lib/colors';
import { fullName, toMinutes } from '@/lib/timeline';
import type { Lesson } from './types';

interface Props {
  lessons: Lesson[];
  now: { day: string; minutes: number } | null;
  current: Lesson[];
  loading: boolean;
}

// "What's happening right now": the lessons in progress, or the next one today
export function NowPanel({ lessons, now, current, loading }: Props) {
  const t = useTranslations('NowPanel');

  if (!now || loading) {
    return <div aria-hidden className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />;
  }

  const today = lessons.filter((lesson) => lesson.date === now.day);
  const next = today.find((lesson) => toMinutes(lesson.startTime) > now.minutes);

  return (
    <section aria-labelledby="now-panel-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="now-panel-title" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        <span className="relative flex h-2.5 w-2.5">
          {current.length > 0 && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          )}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${current.length > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </span>
        {t('title')}
      </h2>

      {current.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {current.map((lesson) => (
            <li
              key={lesson.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className={`h-2 w-2 rounded-full ${colorFor(lesson.class.id).dot}`} />
              <span className="font-semibold">{lesson.courseName}</span>
              <span className="text-slate-500">
                {lesson.class.name} · {fullName(lesson.teacher)}
                {lesson.room && ` · ${lesson.room}`}
              </span>
              <span className="text-xs font-medium text-indigo-600">{t('until', { time: lesson.endTime })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{t('none')}</p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        {next
          ? t('next', { course: next.courseName, class: next.class.name, time: next.startTime })
          : today.length > 0
            ? t('noMore')
            : t('noLessons')}
      </p>
    </section>
  );
}
