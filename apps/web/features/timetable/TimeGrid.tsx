'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cardClass } from '@/components/ui/card';
import { EVENT_COLORS, HOLIDAY_STRIPES } from '@/lib/colors';
import { parseDay } from '@/lib/dates/days';
import { hourWindow, toMinutes } from '@/lib/dates/time';
import { useEventTitle } from '@/lib/useEventTitle';
import type { TimetableView } from './model';

// Height of one hour in the grid, in px
const HOUR_HEIGHT = 64;

const formatMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// Larger screens: days across, hours down. One day for the day view, Monday to Friday for the week.
// A line marks the current time on today's column, with the time itself in the hour gutter.
export function TimeGrid({ days, view }: { days: string[]; view: TimetableView }) {
  const t = useTranslations('MyTimetable');
  const format = useFormatter();
  const eventTitle = useEventTitle();
  const { startHour, endHour } = hourWindow(view.lessons);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` };
  const toTop = (minutes: number) => ((minutes - startHour * 60) / 60) * HOUR_HEIGHT;
  const gridHeight = hours.length * HOUR_HEIGHT;
  // Where the cursor goes, when today is on screen and the time is within the hours shown
  const nowTop = view.now && days.includes(view.now.day) ? toTop(view.now.minutes) : null;
  const cursorVisible = nowTop !== null && nowTop >= 0 && nowTop <= gridHeight;

  return (
    <div className={`overflow-x-auto ${cardClass('none')}`}>
      <div className="min-w-[640px]">
        <div className="grid border-b border-slate-200 bg-slate-50" style={columns}>
          <div />
          {days.map((day) => (
            <div
              key={day}
              className={`border-l border-slate-200 px-3 py-2 text-sm font-semibold first-letter:uppercase ${
                day === view.now?.day ? 'text-indigo-600' : 'text-slate-700'
              }`}
            >
              {format.dateTime(parseDay(day), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
              <div className="mt-1 space-y-1">
                {view.eventsOn(day).map((event) => (
                  <p
                    key={event.id}
                    title={eventTitle(event)}
                    className={`truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${EVENT_COLORS[event.kind].soft} ${EVENT_COLORS[event.kind].text}`}
                  >
                    {eventTitle(event)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid" style={columns}>
          {/* Hour labels, and the current time beside the cursor */}
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour, i) => (
              <span
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-xs text-slate-400 tabular-nums"
                style={{ top: i * HOUR_HEIGHT }}
              >
                {i > 0 && `${String(hour).padStart(2, '0')}:00`}
              </span>
            ))}
            {cursorVisible && view.now && (
              <span
                className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums"
                style={{ top: nowTop }}
              >
                {formatMinutes(view.now.minutes)}
              </span>
            )}
          </div>

          {days.map((day) => {
            const isToday = day === view.now?.day;
            return (
              <div
                key={day}
                className={`relative border-l border-slate-200 ${view.holidayOn(day) ? HOLIDAY_STRIPES : isToday ? 'bg-indigo-50/30' : ''}`}
                style={{ height: gridHeight }}
              >
                {hours.map((hour, i) => (
                  <div key={hour} aria-hidden className="absolute inset-x-0 border-t border-slate-100" style={{ top: i * HOUR_HEIGHT }} />
                ))}

                {view.lessonsOn(day).map((lesson) => {
                  const top = toTop(toMinutes(lesson.startTime));
                  const height = toTop(toMinutes(lesson.endTime)) - top;
                  const live = view.isLive(lesson);
                  const color = view.colorOf(lesson);
                  return (
                    <div
                      key={lesson.id}
                      className={`absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm ${color.soft} ${color.text} ${
                        live ? 'ring-2 ring-indigo-600 ring-offset-1' : ''
                      }`}
                      style={{ top: top + 1, height: height - 2, borderLeftColor: 'currentColor' }}
                    >
                      <p className="truncate font-bold">{lesson.courseName}</p>
                      <p className="truncate opacity-80">
                        {lesson.startTime}–{lesson.endTime}
                      </p>
                      <p className="truncate opacity-80">{view.detailOf(lesson)}</p>
                      {live && (
                        <span className="absolute top-1 right-1 rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white uppercase">
                          {t('inProgress')}
                        </span>
                      )}
                    </div>
                  );
                })}

                {isToday && cursorVisible && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                    <div className="absolute -top-1.5 -left-1.5 h-3 w-3 rounded-full bg-indigo-600" />
                    <div className="h-0.5 bg-indigo-600" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
