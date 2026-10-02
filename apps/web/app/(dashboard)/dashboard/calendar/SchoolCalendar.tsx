'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { EVENT_COLORS, EVENT_KINDS } from '@/lib/colors';
import { buttonClass } from '@/components/ui/button';
import {
  addDays,
  addMonths,
  endOfMonth,
  layoutWeek,
  nowIn,
  parseDay,
  startOfMonth,
  startOfWeek,
} from '@/lib/timeline';
import { useApi } from '@/lib/useApi';
import { browserTimeZone, useNow } from '@/lib/useNow';
import { useEventTitle } from '@/lib/useEventTitle';
import type { SchoolEvent } from '../timeline/types';
import { EventForm } from './EventForm';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';

// Weekend columns are narrower: school life happens Monday to Friday
const COLUMNS = 'repeat(5, minmax(0, 1fr)) repeat(2, minmax(0, 0.6fr))';
// One color per weekday for the header tabs
const WEEKDAY_COLORS = ['bg-rose-500', 'bg-teal-500', 'bg-sky-600', 'bg-orange-500', 'bg-indigo-800', 'bg-slate-400', 'bg-slate-400'];
const LANE_HEIGHT = 30;

export function SchoolCalendar() {
  const t = useTranslations('Calendar');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const eventTitle = useEventTitle();
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'school_admin';

  const [today] = useState(() => nowIn(browserTimeZone()).day);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<SchoolEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Whole weeks around the month, Monday to Sunday
  const gridStart = startOfWeek(month);
  const gridEnd = addDays(startOfWeek(endOfMonth(month)), 6);
  const weeks = useMemo(() => {
    const starts: string[] = [];
    for (let week = gridStart; week <= gridEnd; week = addDays(week, 7)) starts.push(week);
    return starts;
  }, [gridStart, gridEnd]);

  const events = useApi<SchoolEvent[]>(user?.schoolId ? `/api/events?from=${gridStart}&to=${gridEnd}` : null);
  const classes = useApi<{ id: string; name: string }[]>(isAdmin && user?.schoolId ? '/api/classes' : null);
  // Only the day matters here, so the browser's clock is enough
  const now = useNow(browserTimeZone());

  if (!user?.schoolId) {
    return <InfoNote>{t('noSchool')}</InfoNote>;
  }

  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(parseDay(addDays(gridStart, i)), { weekday: 'short', timeZone: 'UTC' }),
  );
  const eventDates = (event: SchoolEvent) =>
    event.startDate === event.endDate
      ? format.dateTime(parseDay(event.startDate), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : format.dateTimeRange(parseDay(event.startDate), parseDay(event.endDate), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });

  async function deleteSelected() {
    if (!selected) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api(`/api/events/${selected.id}`, { token, method: 'DELETE' });
      setSelected(null);
      events.reload();
    } catch (err) {
      setDeleteError(errorMessage(err, tErrors));
    } finally {
      setDeleting(false);
    }
  }

  const list = events.data ?? [];
  const inMonth = list.filter((event) => event.startDate <= endOfMonth(month) && event.endDate >= month);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={format.dateTime(parseDay(month), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          onToday={() => setMonth(startOfMonth(now?.day ?? today))}
          onPrevious={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
        />
        <ul className="ml-auto flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {EVENT_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${EVENT_COLORS[kind].dot}`} />
              {t(`kinds.${kind}`)}
            </li>
          ))}
        </ul>
        {isAdmin && !adding && (
          <button type="button" onClick={() => setAdding(true)} className={buttonClass()}>
            + {t('addEvent')}
          </button>
        )}
      </div>

      {adding && (
        <EventForm
          classes={classes.data ?? []}
          defaultDate={month === startOfMonth(today) ? today : month}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            events.reload();
          }}
        />
      )}

      {selected && (
        <section
          aria-label={eventTitle(selected)}
          className={`flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 p-4 shadow-sm ${EVENT_COLORS[selected.kind].soft}`}
        >
          <span className={`h-10 w-1.5 rounded-full ${EVENT_COLORS[selected.kind].bar}`} />
          <div className="min-w-0">
            <p className="font-bold">{eventTitle(selected)}</p>
            <p className="text-sm text-slate-600">
              {selected.national ? t('national') : `${t(`kinds.${selected.kind}`)} · ${selected.class?.name ?? t('wholeSchool')}`} ·{' '}
              {eventDates(selected)}
            </p>
            {deleteError && (
              <p role="alert" className="text-sm text-red-600">
                {deleteError}
              </p>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {isAdmin && !selected.national && (
              <button
                type="button"
                onClick={deleteSelected}
                disabled={deleting}
                className={`${buttonClass('ghost')} text-red-600 hover:bg-red-50 hover:text-red-700`}
              >
                {deleting ? t('deleting') : t('delete')}
              </button>
            )}
            <button type="button" onClick={() => setSelected(null)} className={buttonClass('secondary')}>
              {t('close')}
            </button>
          </div>
        </section>
      )}

      {events.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : (
        <div
          className={`overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-opacity sm:p-5 ${events.loading ? 'opacity-60' : ''}`}
          aria-busy={events.loading}
        >
          <div className="min-w-[640px]">
            {/* Weekday tabs, like the ribbons in a printed planner */}
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: COLUMNS }}>
              {weekdayNames.map((name, i) => (
                <div
                  key={name}
                  className={`rounded-b-xl rounded-t-sm py-2 text-center text-xs font-bold uppercase tracking-wide text-white shadow-sm ${WEEKDAY_COLORS[i]}`}
                >
                  {name}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {weeks.map((weekStart) => {
                const { pieces, lanes } = layoutWeek(weekStart, list);
                const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                return (
                  <div key={weekStart} className="relative">
                    {/* Day cells */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: COLUMNS }}>
                      {days.map((day, i) => {
                        const outside = day.slice(0, 7) !== month.slice(0, 7);
                        const isToday = day === (now?.day ?? today);
                        return (
                          <div
                            key={day}
                            className={`rounded-lg border-b-4 px-2 pt-1.5 ${i >= 5 ? 'border-slate-100 bg-slate-50/70' : 'border-slate-200 bg-slate-50/30'} ${outside ? 'opacity-40' : ''}`}
                            style={{ minHeight: 44 + Math.max(lanes, 1) * LANE_HEIGHT }}
                          >
                            <span
                              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm tabular-nums ${
                                isToday ? 'bg-indigo-600 font-bold text-white' : 'font-medium text-slate-600'
                              }`}
                              aria-current={isToday ? 'date' : undefined}
                            >
                              {parseDay(day).getUTCDate()}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Event bars, laid over the day cells */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-9 grid gap-x-2"
                      style={{ gridTemplateColumns: COLUMNS, gridAutoRows: LANE_HEIGHT }}
                    >
                      {pieces.map(({ item, startColumn, endColumn, lane, clippedStart, clippedEnd }) => {
                        const color = EVENT_COLORS[item.kind];
                        return (
                          <button
                            key={`${item.id}-${weekStart}`}
                            type="button"
                            onClick={() => setSelected(item)}
                            title={`${eventTitle(item)} · ${eventDates(item)}`}
                            className={`pointer-events-auto mb-1 flex min-w-0 items-center gap-1.5 overflow-hidden border border-black/5 py-0.5 pl-0.5 pr-2 text-left text-xs font-semibold shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${color.soft} ${color.text} ${
                              clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l-full'
                            } ${clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r-full'}`}
                            style={{ gridColumn: `${startColumn + 1} / ${endColumn + 2}`, gridRow: lane + 1 }}
                          >
                            {/* The round badge from the example: the class, or the event type for the whole school */}
                            <span
                              className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${color.bar}`}
                            >
                              {item.class?.name ?? t(`kinds.${item.kind}`).charAt(0)}
                            </span>
                            <span className="truncate">{eventTitle(item)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {!events.loading && inMonth.length === 0 && (
              <p className="mt-4 text-center text-sm text-slate-500">{t('empty')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
