'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth, type Role } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { nowIn } from '@/lib/dates/clock';
import { addDays, addMonths, daysInRange, endOfMonth, isWeekend, parseDay, startOfMonth, startOfWeek } from '@/lib/dates/days';
import type { LessonsResponse, SchoolEvent } from '@/lib/types/school';
import { browserTimeZone, useNow } from '@/lib/useNow';
import { DayList } from './DayList';
import { buildView } from './model';
import { MonthGrid } from './MonthGrid';
import { TimeGrid } from './TimeGrid';

type Mode = 'day' | 'week' | 'month';

const MODES: Mode[] = ['day', 'week', 'month'];

const ROLES_WITH_TIMETABLE: Role[] = ['teacher', 'student', 'parent'];

// The days a mode shows around the anchor: the day itself, Monday to Sunday, or the whole weeks around a month
function rangeOf(mode: Mode, anchor: string) {
  if (mode === 'day') return { from: anchor, to: anchor };
  if (mode === 'week') return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) };
  return { from: startOfWeek(startOfMonth(anchor)), to: addDays(startOfWeek(endOfMonth(anchor)), 6) };
}

export function MyTimetable() {
  const t = useTranslations('MyTimetable');
  const format = useFormatter();
  const { user } = useAuth();
  const allowed = Boolean(user && ROLES_WITH_TIMETABLE.includes(user.role));

  const [today] = useState(() => nowIn(browserTimeZone()).day);
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState(today);

  const { from, to } = rangeOf(mode, anchor);
  const query = `from=${from}&to=${to}`;
  const lessons = useApi<LessonsResponse>(allowed ? `/api/timetable?${query}` : null);
  const events = useApi<SchoolEvent[]>(allowed && user?.schoolId ? `/api/events?${query}` : null);
  const now = useNow(lessons.data?.timezone ?? browserTimeZone());

  const view = useMemo(
    () => buildView(lessons.data?.lessons ?? [], events.data ?? [], user?.role, now),
    [lessons.data, events.data, user?.role, now],
  );

  if (!allowed) return <InfoNote>{t('onlyMembers')}</InfoNote>;

  const label = {
    day: () => format.dateTime(parseDay(anchor), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    week: () => format.dateTimeRange(parseDay(from), parseDay(to), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
    month: () => format.dateTime(parseDay(anchor), { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  }[mode]();
  // How far one press of ‹ or › moves
  const step = (direction: -1 | 1) =>
    mode === 'day' ? addDays(anchor, direction) : mode === 'week' ? addDays(anchor, 7 * direction) : addMonths(anchor, direction);

  // Weekends only take space in the week when something happens on them
  const weekDays = daysInRange(from, to).filter((day) => !isWeekend(day) || view.lessonsOn(day).length > 0);
  // On phones the month becomes a list of the days that have something on
  const busyMonthDays = daysInRange(startOfMonth(anchor), endOfMonth(anchor)).filter(
    (day) => view.lessonsOn(day).length > 0 || view.eventsOn(day).length > 0,
  );
  const weeks = daysInRange(from, to).filter((_, i) => i % 7 === 0);

  const openWeek = (day: string) => {
    setMode('week');
    setAnchor(day);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={label}
          todayLabel={{ day: undefined, week: t('thisWeek'), month: t('thisMonth') }[mode]}
          onToday={() => setAnchor(now?.day ?? today)}
          onPrevious={() => setAnchor(step(-1))}
          onNext={() => setAnchor(step(1))}
        />
        <div className="ml-auto">
          <SegmentedControl
            label={t('view')}
            value={mode}
            onChange={setMode}
            segments={MODES.map((value) => ({ value, label: t(`views.${value}`) }))}
          />
        </div>
      </div>

      {lessons.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : (
        <div className={`transition-opacity ${lessons.loading ? 'opacity-60' : ''}`} aria-busy={lessons.loading}>
          <div className="sm:hidden">
            <DayList days={{ day: [anchor], week: weekDays, month: busyMonthDays }[mode]} view={view} />
          </div>
          <div className="hidden sm:block">
            {mode === 'month' ? (
              <MonthGrid month={startOfMonth(anchor)} weeks={weeks} view={view} onOpenWeek={openWeek} />
            ) : (
              <TimeGrid days={mode === 'day' ? [anchor] : weekDays} view={view} />
            )}
          </div>

          {!lessons.loading && view.lessons.length === 0 && (
            <p className="mt-4 text-center text-sm text-slate-500">
              {{ day: t('emptyDay'), week: t('empty'), month: t('emptyMonth') }[mode]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
