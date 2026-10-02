'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { colorFor } from '@/lib/colors';
import { useEventTitle } from '@/lib/useEventTitle';
import {
  barPosition,
  fullName,
  isWeekend,
  parseDay,
  toMinutes,
  type Scale,
  type TimelineGroup,
  type TimelineItem,
  type Zoom,
} from '@/lib/timeline';
import type { SchoolEvent } from './types';

// Width of the sticky label column, in px (Tailwind w-56)
const LABEL_WIDTH = 224;
// How wide the time track is at least, before it scrolls sideways
const MIN_TRACK_WIDTH: Record<Zoom, number> = { term: 980, month: 1100, week: 980, day: 800 };

const pct = (value: number) => `${value * 100}%`;

interface Props {
  zoom: Zoom;
  scale: Scale;
  groups: TimelineGroup[];
  events: SchoolEvent[];
  now: { day: string; minutes: number } | null;
  liveCourseIds: Set<string>;
  loading: boolean;
  searching: boolean;
  scrollRequest: number;
}

export function TimelineGrid({ zoom, scale, groups, events, now, liveCourseIds, loading, searching, scrollRequest }: Props) {
  const t = useTranslations('Timeline');
  const format = useFormatter();
  const eventTitle = useEventTitle();
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledScroll = useRef(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const timeZoom = zoom === 'week' || zoom === 'day';
  const dayWidth = 1 / scale.days.length;

  const nowX = now ? scale.x(now.day, now.minutes) : null;

  // Center the now line once per request (first load, "Today" button)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || nowX === null || handledScroll.current === scrollRequest) return;
    handledScroll.current = scrollRequest;
    const trackWidth = el.scrollWidth - LABEL_WIDTH;
    el.scrollLeft = LABEL_WIDTH + nowX * trackWidth - el.clientWidth / 2;
  }, [scrollRequest, nowX]);

  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Days to shade: whole-school holidays, plus weekends in the month view
  const holidays = events.filter((event) => event.kind === 'holiday' && !event.class);
  const shaded = scale.days.flatMap((day, index) => {
    const holiday = holidays.find((event) => event.startDate <= day && day <= event.endDate);
    if (holiday) return [{ day, index, title: eventTitle(holiday), holiday: true }];
    if (zoom === 'month' && isWeekend(day)) return [{ day, index, title: '', holiday: false }];
    return [];
  });

  const describe = (item: TimelineItem) => {
    const who = `${item.courseName} · ${item.class.name} · ${fullName(item.teacher)}`;
    if (item.startTime) return `${who}\n${item.startTime}–${item.endTime}${item.room ? ` · ${item.room}` : ''}`;
    const dates = format.dateTimeRange(parseDay(item.startDay), parseDay(item.endDay), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    return `${who}\n${dates}`;
  };

  const position = (item: TimelineItem) =>
    item.startTime
      ? barPosition(
          scale,
          { day: item.startDay, minutes: toMinutes(item.startTime) },
          { day: item.endDay, minutes: toMinutes(item.endTime!) },
        )
      : barPosition(scale, { day: item.startDay }, { day: item.endDay, minutes: 1440 });

  const isLive = (item: TimelineItem) =>
    Boolean(
      now &&
        item.startTime &&
        item.startDay === now.day &&
        toMinutes(item.startTime) <= now.minutes &&
        now.minutes < toMinutes(item.endTime!),
    );

  const topLabel = (day: string, width: number) =>
    timeZoom
      ? format.dateTime(parseDay(day), { weekday: zoom === 'day' ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      : format.dateTime(parseDay(day), { month: width > 0.12 ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });

  const bottomLabel = (day: string, hour?: number) =>
    hour !== undefined ? `${String(hour).padStart(2, '0')}${zoom === 'day' ? ':00' : ''}` : String(parseDay(day).getUTCDate());

  const empty = groups.length === 0;

  return (
    <div
      ref={scrollRef}
      className={`relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${loading ? 'opacity-60' : ''}`}
      aria-busy={loading}
    >
      <div style={{ minWidth: LABEL_WIDTH + MIN_TRACK_WIDTH[zoom] }}>
        {/* Header: months or days on top, weeks, days or hours below */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
          <div className="sticky left-0 z-20 flex w-56 shrink-0 items-end border-r border-slate-200 bg-slate-50 px-4 py-2 font-semibold uppercase tracking-wide">
            {t('courseColumn')}
          </div>
          <div className="relative h-14 flex-1">
            {scale.top.map((segment) => (
              <div
                key={segment.key}
                className="absolute top-0 h-7 truncate border-l border-slate-200 px-2 pt-1.5 font-semibold text-slate-700 first-letter:uppercase"
                style={{ left: pct(segment.left), width: pct(segment.width) }}
              >
                {topLabel(segment.day, segment.width)}
              </div>
            ))}
            {scale.bottom.map((segment) => (
              <div
                key={segment.key}
                className={`absolute bottom-0 h-7 truncate border-l border-t border-slate-200 pt-1.5 text-center tabular-nums ${
                  !timeZoom && isWeekend(segment.day) && zoom === 'month' ? 'text-slate-400' : ''
                } ${segment.day === now?.day && !timeZoom ? 'font-bold text-indigo-600' : ''}`}
                style={{ left: pct(segment.left), width: pct(segment.width) }}
              >
                {bottomLabel(segment.day, segment.hour)}
              </div>
            ))}
            {nowX !== null && (
              <span
                className="absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                style={{ left: pct(nowX) }}
              >
                {t('now')}
              </span>
            )}
          </div>
        </div>

        <div className="relative">
          {/* Background: shaded days and grid lines, behind the rows */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_WIDTH }}>
            {shaded.map(({ day, index, title, holiday }) => (
              <div
                key={day}
                title={title}
                className={`absolute inset-y-0 ${holiday ? 'bg-rose-50 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(254_205_211/0.5)_6px_8px)]' : 'bg-slate-50'}`}
                style={{ left: pct(index * dayWidth), width: pct(dayWidth) }}
              />
            ))}
            {scale.bottom.map((segment) => (
              <div
                key={segment.key}
                className={`absolute inset-y-0 border-l ${segment.hour === undefined || segment.hour === scale.bottom[0]!.hour ? 'border-slate-200' : 'border-slate-100'}`}
                style={{ left: pct(segment.left) }}
              />
            ))}
          </div>

          {empty && !loading && (
            <p className="relative px-6 py-12 text-center text-sm text-slate-500">
              {searching ? t('noMatches') : timeZoom ? t('emptyLessons') : t('emptyCourses')}
            </p>
          )}

          {groups.map((group) => {
            const color = colorFor(group.colorKey);
            const open = !collapsed.has(group.key);
            return (
              <div key={group.key} role="rowgroup">
                {/* Group row: name, count and a faint summary of everything inside */}
                <div className="relative flex border-b border-slate-100 bg-slate-50/60">
                  <div className="sticky left-0 z-20 flex w-56 shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggle(group.key)}
                      aria-expanded={open}
                      aria-label={open ? t('collapse', { name: group.label }) : t('expand', { name: group.label })}
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
                    >
                      <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
                        ›
                      </span>
                    </button>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`} />
                    <span className="truncate text-sm font-bold">{group.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{t('courses', { count: group.rows.length })}</span>
                  </div>
                  <div className="relative h-10 flex-1">
                    {group.items.map((item) => {
                      const pos = position(item);
                      return (
                        pos && (
                          <div
                            key={item.id}
                            className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-50 ${color.bar}`}
                            style={{ left: pct(pos.left), width: pct(pos.width) }}
                          />
                        )
                      );
                    })}
                  </div>
                </div>

                {open &&
                  group.rows.map((row) => {
                    const live = liveCourseIds.has(row.key);
                    return (
                      <div key={row.key} className="relative flex border-b border-slate-100 hover:bg-indigo-50/30">
                        <div className="sticky left-0 z-20 flex w-56 shrink-0 items-center gap-2 border-r border-slate-200 bg-white py-2 pl-10 pr-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">{row.label}</p>
                            <p className="truncate text-xs text-slate-500">{row.sublabel}</p>
                          </div>
                          {live && (
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase text-emerald-600">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                              </span>
                              <span className="sr-only sm:not-sr-only">{t('inProgress')}</span>
                            </span>
                          )}
                        </div>
                        <div className="relative h-12 flex-1">
                          {row.items.map((item) => {
                            const pos = position(item);
                            if (!pos) return null;
                            const itemLive = isLive(item);
                            return (
                              <div
                                key={item.id}
                                role="img"
                                aria-label={describe(item)}
                                title={describe(item)}
                                className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden px-2 text-[11px] font-semibold text-white shadow-sm ${color.bar} ${
                                  timeZoom ? 'rounded-md' : `${pos.clippedStart ? '' : 'rounded-l-full'} ${pos.clippedEnd ? '' : 'rounded-r-full'}`
                                } ${itemLive ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                                style={{ left: pct(pos.left), width: pct(pos.width) }}
                              >
                                <span className="truncate">
                                  {timeZoom ? (zoom === 'day' ? `${item.startTime} · ${item.room ?? ''}` : '') : item.courseName}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}

          {/* The now line, above the bars */}
          {nowX !== null && (
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10" style={{ left: LABEL_WIDTH }}>
              <div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-indigo-600" style={{ left: pct(nowX) }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
