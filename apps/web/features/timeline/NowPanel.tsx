'use client';

import { useTranslations } from 'next-intl';
import { cardClass } from '@/components/ui/card';
import { LiveDot } from '@/components/ui/LiveDot';
import { Skeleton } from '@/components/ui/Skeleton';
import { colorFor } from '@/lib/colors';
import { toMinutes } from '@/lib/dates/time';
import { fullName } from '@/lib/people';
import type { Lesson } from '@/lib/types/school';

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
    return <Skeleton className="h-24 rounded-2xl border border-slate-200 bg-white" />;
  }

  const today = lessons.filter((lesson) => lesson.date === now.day);
  const next = today.find((lesson) => toMinutes(lesson.startTime) > now.minutes);

  return (
    <section aria-labelledby="now-panel-title" className={cardClass()}>
      <h2 id="now-panel-title" className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-500 uppercase">
        <LiveDot live={current.length > 0} size="md" />
        {t('title')}
      </h2>

      {current.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {current.map((lesson) => (
            <li key={lesson.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
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
