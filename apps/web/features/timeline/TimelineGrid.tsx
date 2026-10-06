'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { SchoolEvent } from '@/lib/types/school';
import type { TimelineGroup } from './grouping';
import { LABEL_WIDTH, LABEL_WIDTH_CLASS, MIN_TRACK_WIDTH, pct } from './layout';
import type { Zoom } from './ranges';
import type { Scale } from './scales';
import { TimelineBackground } from './TimelineBackground';
import { TimelineGroupRows } from './TimelineGroupRows';
import { TimelineHeader } from './TimelineHeader';

interface Props {
  zoom: Zoom;
  scale: Scale;
  groups: TimelineGroup[];
  events: SchoolEvent[];
  now: { day: string; minutes: number } | null;
  liveCourseIds: Set<string>;
  loading: boolean;
  searching: boolean;
  // Bumped to ask for the now line to be scrolled into view
  scrollRequest: number;
}

export function TimelineGrid({ zoom, scale, groups, events, now, liveCourseIds, loading, searching, scrollRequest }: Props) {
  const t = useTranslations('Timeline');
  const scrollRef = useRef<HTMLDivElement>(null);
  const handledScroll = useRef(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const nowX = now ? scale.x(now.day, now.minutes) : null;
  const timeZoom = zoom === 'week' || zoom === 'day';

  // Centers the now line once per request (first load, the Today button)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || nowX === null || handledScroll.current === scrollRequest) return;
    handledScroll.current = scrollRequest;
    const labelWidth = el.querySelector<HTMLElement>('[data-label-column]')?.offsetWidth ?? 0;
    el.scrollLeft = labelWidth + nowX * (el.scrollWidth - labelWidth) - el.clientWidth / 2;
  }, [scrollRequest, nowX]);

  const toggle = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div
      ref={scrollRef}
      className={`relative overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${LABEL_WIDTH_CLASS} ${
        loading ? 'opacity-60' : ''
      }`}
      aria-busy={loading}
    >
      <div style={{ minWidth: `calc(${LABEL_WIDTH} + ${MIN_TRACK_WIDTH[zoom]}px)` }}>
        <TimelineHeader zoom={zoom} scale={scale} today={now?.day} nowX={nowX} />

        <div className="relative">
          <TimelineBackground zoom={zoom} scale={scale} events={events} />

          {groups.length === 0 && !loading && (
            <p className="relative px-6 py-12 text-center text-sm text-slate-500">
              {searching ? t('noMatches') : timeZoom ? t('emptyLessons') : t('emptyCourses')}
            </p>
          )}

          {groups.map((group) => (
            <TimelineGroupRows
              key={group.key}
              group={group}
              open={!collapsed.has(group.key)}
              onToggle={() => toggle(group.key)}
              zoom={zoom}
              scale={scale}
              now={now}
              liveCourseIds={liveCourseIds}
            />
          ))}

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
