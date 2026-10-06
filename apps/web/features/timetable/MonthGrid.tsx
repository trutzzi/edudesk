'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cardClass } from '@/components/ui/card';
import { EVENT_COLORS, HOLIDAY_STRIPES } from '@/lib/colors';
import { addDays, parseDay } from '@/lib/dates/days';
import { useEventTitle } from '@/lib/useEventTitle';
import type { TimetableView } from './model';

// Weekend columns are narrower, as in the school calendar
const COLUMNS = { gridTemplateColumns: 'repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.6fr))' };
// More than this and a day says "+N more", which opens its week
const LESSONS_PER_DAY = 4;

interface Props {
  // The first day of the month shown
  month: string;
  // Mondays of the weeks in the grid
  weeks: string[];
  view: TimetableView;
  onOpenWeek: (day: string) => void;
}

export function MonthGrid({ month, weeks, view, onOpenWeek }: Props) {
  const t = useTranslations('MyTimetable');
  const format = useFormatter();
  const eventTitle = useEventTitle();
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(parseDay(addDays(weeks[0], i)), { weekday: 'short', timeZone: 'UTC' }),
  );

  return (
    <div className={`overflow-x-auto ${cardClass('sm')}`}>
      <div className="min-w-[760px] space-y-2">
        <div className="grid gap-2 text-center text-xs font-bold tracking-wide text-slate-500 uppercase" style={COLUMNS}>
          {weekdays.map((name) => (
            <div key={name} className="py-1">
              {name}
            </div>
          ))}
        </div>

        {weeks.map((weekStart) => (
          <div key={weekStart} className="grid gap-2" style={COLUMNS}>
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
              const lessons = view.lessonsOn(day);
              const hidden = lessons.length - LESSONS_PER_DAY;
              const outside = day.slice(0, 7) !== month.slice(0, 7);
              const isToday = day === view.now?.day;
              const dayName = format.dateTime(parseDay(day), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

              return (
                <div
                  key={day}
                  className={`min-h-28 rounded-lg border p-1.5 ${isToday ? 'border-indigo-300 ring-1 ring-indigo-300' : 'border-slate-100'} ${
                    view.holidayOn(day) ? HOLIDAY_STRIPES : 'bg-slate-50/40'
                  } ${outside ? 'opacity-40' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenWeek(day)}
                    aria-label={t('openWeek', { day: dayName })}
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm tabular-nums hover:bg-indigo-100 ${
                      isToday ? 'bg-indigo-600 font-bold text-white hover:bg-indigo-700' : 'font-medium text-slate-600'
                    }`}
                  >
                    {parseDay(day).getUTCDate()}
                  </button>

                  <div className="mt-1 space-y-0.5">
                    {view.eventsOn(day).map((event) => (
                      <p
                        key={event.id}
                        title={eventTitle(event)}
                        className={`truncate rounded px-1.5 text-[11px] font-semibold ${EVENT_COLORS[event.kind].soft} ${EVENT_COLORS[event.kind].text}`}
                      >
                        {eventTitle(event)}
                      </p>
                    ))}
                    {lessons.slice(0, LESSONS_PER_DAY).map((lesson) => {
                      const live = view.isLive(lesson);
                      return (
                        <p
                          key={lesson.id}
                          title={`${lesson.startTime}–${lesson.endTime} ${lesson.courseName} · ${view.detailOf(lesson)}`}
                          className={`flex items-center gap-1 truncate rounded px-1 text-[11px] ${live ? 'bg-indigo-100 font-semibold text-indigo-800' : 'text-slate-700'}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${view.colorOf(lesson).dot}`} />
                          <span className="text-slate-500 tabular-nums">{lesson.startTime}</span>
                          <span className="truncate">{lesson.courseName}</span>
                        </p>
                      );
                    })}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenWeek(day)}
                        className="px-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        {t('more', { count: hidden })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
