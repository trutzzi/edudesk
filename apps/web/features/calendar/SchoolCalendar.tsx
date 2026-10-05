'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { EVENT_COLORS, EVENT_KINDS } from '@/lib/colors';
import { nowIn } from '@/lib/dates/clock';
import { addDays, addMonths, endOfMonth, parseDay, startOfMonth, startOfWeek } from '@/lib/dates/days';
import type { SchoolEvent } from '@/lib/types/school';
import { browserTimeZone, useNow } from '@/lib/useNow';
import { CalendarAgenda } from './CalendarAgenda';
import { CalendarWeekRow } from './CalendarWeekRow';
import { EventDetails } from './EventDetails';
import { EventForm } from './EventForm';
import { COLUMNS, WEEKDAY_COLORS } from './layout';

export function SchoolCalendar() {
  const t = useTranslations('Calendar');
  const format = useFormatter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'school_admin';

  const [today] = useState(() => nowIn(browserTimeZone()).day);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<SchoolEvent | null>(null);

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

  if (!user?.schoolId) return <InfoNote>{t('noSchool')}</InfoNote>;

  const list = events.data ?? [];
  const inMonth = list
    .filter((event) => event.startDate <= endOfMonth(month) && event.endDate >= month)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(parseDay(addDays(gridStart, i)), { weekday: 'short', timeZone: 'UTC' }),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={format.dateTime(parseDay(month), { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          onToday={() => setMonth(startOfMonth(now?.day ?? today))}
          onPrevious={() => setMonth(addMonths(month, -1))}
          onNext={() => setMonth(addMonths(month, 1))}
        />
        <ul className="ml-auto hidden flex-wrap items-center gap-3 text-xs text-slate-500 sm:flex">
          {EVENT_KINDS.map((kind) => (
            <li key={kind} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${EVENT_COLORS[kind].dot}`} />
              {t(`kinds.${kind}`)}
            </li>
          ))}
        </ul>
        {isAdmin && !adding && (
          <button type="button" onClick={() => setAdding(true)} className={`${buttonClass()} w-full sm:w-auto`}>
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
        <EventDetails
          key={selected.id}
          event={selected}
          canDelete={isAdmin}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            events.reload();
          }}
        />
      )}

      {events.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : (
        <div className={`transition-opacity ${events.loading ? 'opacity-60' : ''}`} aria-busy={events.loading}>
          <div className="sm:hidden">
            <CalendarAgenda events={inMonth} onSelect={setSelected} />
          </div>
          <div
            role="group"
            aria-label={t('monthGrid')}
            className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:block"
          >
            <div className="min-w-[640px]">
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
                {weeks.map((weekStart) => (
                  <CalendarWeekRow
                    key={weekStart}
                    weekStart={weekStart}
                    month={month}
                    today={now?.day ?? today}
                    events={list}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            </div>
          </div>
          {!events.loading && inMonth.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">{t('empty')}</p>}
        </div>
      )}
    </div>
  );
}
