'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { nowIn } from '@/lib/dates/clock';
import { addDays, daysInRange, isWeekend, parseDay } from '@/lib/dates/days';
import { hourWindow, toMinutes } from '@/lib/dates/time';
import type { CoursesResponse, LessonsResponse, SchoolEvent } from '@/lib/types/school';
import { browserTimeZone, useNow } from '@/lib/useNow';
import { type GroupBy, groupItems, matchesSearch, type TimelineItem } from './grouping';
import { NowPanel } from './NowPanel';
import { rangeFor, shiftAnchor, type Zoom } from './ranges';
import { dateScale, timeScale } from './scales';
import { TimelineFilters } from './TimelineFilters';
import { TimelineGrid } from './TimelineGrid';

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
  const todays = useApi<LessonsResponse>(isAdmin ? `/api/timeline/lessons?from=${addDays(today, -1)}&to=${addDays(today, 1)}` : null);

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
    const days = daysInRange(range.from, range.to).filter((day) => !isWeekend(day) || items.some((item) => item.startDay === day));
    const { startHour, endHour } = hourWindow(items.filter((item) => item.startTime) as Required<TimelineItem>[]);
    return timeScale(days.length > 0 ? days : [range.from], startHour, endHour);
  }, [zoom, range.from, range.to, items]);

  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);

  // Lessons running right now, by the school's clock
  const current = useMemo(
    () =>
      (todays.data?.lessons ?? []).filter(
        (lesson) => now && lesson.date === now.day && toMinutes(lesson.startTime) <= now.minutes && now.minutes < toMinutes(lesson.endTime),
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

        <TimelineFilters search={search} onSearch={setSearch} groupBy={groupBy} onGroupBy={setGroupBy} zoom={zoom} onZoom={setZoom} />
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
