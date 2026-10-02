'use client';

import { useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import {
  addDays,
  dateScale,
  daysInRange,
  groupItems,
  hourWindow,
  isWeekend,
  matchesSearch,
  nowIn,
  parseDay,
  rangeFor,
  shiftAnchor,
  timeScale,
  toMinutes,
  type GroupBy,
  type TimelineItem,
  type Zoom,
} from '@/lib/timeline';
import { useApi } from '@/lib/useApi';
import { browserTimeZone, useNow } from '@/lib/useNow';
import { NowPanel } from './NowPanel';
import { TimelineGrid } from './TimelineGrid';
import type { CoursesResponse, LessonsResponse, SchoolEvent } from './types';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { compactControlClass } from '@/components/ui/Field';

const ZOOMS: Zoom[] = ['term', 'month', 'week', 'day'];


export function Timeline() {
  const t = useTranslations('Timeline');
  const format = useFormatter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'school_admin';

  // Today in the browser's time zone; close enough to pick the first page and today's lessons
  const [today] = useState(() => nowIn(browserTimeZone()).day);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [anchor, setAnchor] = useState(today);
  const [groupBy, setGroupBy] = useState<GroupBy>('class');
  const [search, setSearch] = useState('');
  // Bumped to ask the grid to scroll the now line into view
  const [scrollRequest, setScrollRequest] = useState(1);

  const range = rangeFor(zoom, anchor);
  const timeZoom = zoom === 'week' || zoom === 'day';
  const query = `from=${range.from}&to=${range.to}`;

  // Term and month views draw whole courses; week and day views draw individual lessons
  const courses = useApi<CoursesResponse>(isAdmin && !timeZoom ? `/api/timeline/courses?${query}` : null);
  const lessons = useApi<LessonsResponse>(isAdmin && timeZoom ? `/api/timeline/lessons?${query}` : null);
  const events = useApi<SchoolEvent[]>(isAdmin ? `/api/events?${query}` : null);
  // Yesterday to tomorrow, so "today at the school" is covered whatever the browser's time zone
  const todays = useApi<LessonsResponse>(
    isAdmin ? `/api/timeline/lessons?from=${addDays(today, -1)}&to=${addDays(today, 1)}` : null,
  );

  const timeZone = todays.data?.timezone ?? courses.data?.timezone ?? lessons.data?.timezone ?? browserTimeZone();
  const now = useNow(timeZone);

  const items = useMemo<TimelineItem[]>(() => {
    const all: TimelineItem[] = timeZoom
      ? (lessons.data?.lessons ?? []).map((lesson) => ({
          id: `${lesson.id}:${lesson.date}`,
          courseId: lesson.courseId,
          courseName: lesson.courseName,
          class: lesson.class,
          teacher: lesson.teacher,
          startDay: lesson.date,
          endDay: lesson.date,
          startTime: lesson.startTime,
          endTime: lesson.endTime,
          room: lesson.room,
        }))
      : (courses.data?.courses ?? []).map((course) => ({
          id: course.id,
          courseId: course.id,
          courseName: course.name,
          class: course.class,
          teacher: course.teacher,
          startDay: course.startDate,
          endDay: course.endDate,
        }));
    return all.filter((item) => matchesSearch(item, search));
  }, [timeZoom, lessons.data, courses.data, search]);

  const scale = useMemo(() => {
    if (zoom === 'term') return dateScale(range.from, range.to, 'weeks');
    if (zoom === 'month') return dateScale(range.from, range.to, 'days');
    // Weekends only take space when something happens on them
    const days = daysInRange(range.from, range.to).filter(
      (day) => !isWeekend(day) || items.some((item) => item.startDay === day),
    );
    const { startHour, endHour } = hourWindow(items.filter((item) => item.startTime) as Required<TimelineItem>[]);
    return timeScale(days.length > 0 ? days : [range.from], startHour, endHour);
  }, [zoom, range.from, range.to, items]);

  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);

  // Lessons running right now, by the school's clock
  const current = useMemo(
    () =>
      (todays.data?.lessons ?? []).filter(
        (lesson) =>
          now &&
          lesson.date === now.day &&
          toMinutes(lesson.startTime) <= now.minutes &&
          now.minutes < toMinutes(lesson.endTime),
      ),
    [todays.data, now],
  );
  const liveCourseIds = useMemo(() => new Set(current.map((lesson) => lesson.courseId)), [current]);

  if (!isAdmin) {
    return <InfoNote>{t('onlyAdmins')}</InfoNote>;
  }

  const rangeLabel =
    zoom === 'day'
      ? format.dateTime(parseDay(range.from), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
      : format.dateTimeRange(parseDay(range.from), parseDay(range.to), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        });

  const goToday = () => {
    setAnchor(now?.day ?? today);
    setScrollRequest((n) => n + 1);
  };

  const failed = (timeZoom ? lessons.error : courses.error) !== undefined;
  const loading = timeZoom ? lessons.loading : courses.loading;

  return (
    <div className="space-y-4">
      <NowPanel lessons={todays.data?.lessons ?? []} now={now} current={current} loading={todays.loading} />

      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={rangeLabel}
          onToday={goToday}
          onPrevious={() => setAnchor(shiftAnchor(zoom, anchor, -1))}
          onNext={() => setAnchor(shiftAnchor(zoom, anchor, 1))}
        />

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className={`${compactControlClass} w-full font-normal sm:w-72`}
          />
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t('groupBy')}
            <select value={groupBy} onChange={(event) => setGroupBy(event.target.value as GroupBy)} className={compactControlClass}>
              <option value="class">{t('byClass')}</option>
              <option value="teacher">{t('byTeacher')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            {t('zoom')}
            <select value={zoom} onChange={(event) => setZoom(event.target.value as Zoom)} className={compactControlClass}>
              {ZOOMS.map((z) => (
                <option key={z} value={z}>
                  {t(`zooms.${z}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {failed ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : (
        <TimelineGrid
          zoom={zoom}
          scale={scale}
          groups={groups}
          events={events.data ?? []}
          now={now}
          liveCourseIds={liveCourseIds}
          loading={loading}
          searching={search.trim() !== ''}
          scrollRequest={scrollRequest}
        />
      )}
    </div>
  );
}
