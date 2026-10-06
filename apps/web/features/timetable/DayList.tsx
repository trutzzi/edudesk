'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { EVENT_COLORS } from '@/lib/colors';
import { parseDay } from '@/lib/dates/days';
import { useEventTitle } from '@/lib/useEventTitle';
import type { TimetableView } from './model';

// Phones: one card per day, lessons as a list
export function DayList({ days, view }: { days: string[]; view: TimetableView }) {
  const t = useTranslations('MyTimetable');
  const format = useFormatter();
  const eventTitle = useEventTitle();

  return (
    <ol className="space-y-3">
      {days.map((day) => {
        const lessons = view.lessonsOn(day);
        return (
          <li key={day} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className={`text-sm font-bold first-letter:uppercase ${day === view.now?.day ? 'text-indigo-600' : ''}`}>
              {format.dateTime(parseDay(day), { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })}
            </h3>
            {view.eventsOn(day).map((event) => (
              <p
                key={event.id}
                className={`mt-2 rounded-lg px-2 py-1 text-xs font-semibold ${EVENT_COLORS[event.kind].soft} ${EVENT_COLORS[event.kind].text}`}
              >
                {eventTitle(event)}
              </p>
            ))}
            {lessons.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">{t('noLessonsDay')}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {lessons.map((lesson) => {
                  const live = view.isLive(lesson);
                  return (
                    <li key={lesson.id} className={`flex gap-3 rounded-lg p-2 ${live ? 'bg-indigo-50 ring-2 ring-indigo-500' : ''}`}>
                      <span className={`w-1 shrink-0 rounded-full ${view.colorOf(lesson).bar}`} />
                      <span className="w-24 shrink-0 text-sm tabular-nums text-slate-500">
                        {lesson.startTime}–{lesson.endTime}
                      </span>
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold">{lesson.courseName}</span>
                        <span className="block text-xs text-slate-500">{view.detailOf(lesson)}</span>
                        {live && <span className="text-xs font-semibold text-indigo-600">{t('inProgress')}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
