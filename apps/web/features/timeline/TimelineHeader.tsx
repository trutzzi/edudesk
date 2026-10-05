'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { isWeekend, parseDay } from '@/lib/dates/days';
import { pct } from './layout';
import type { Zoom } from './ranges';
import type { Scale } from './scales';

interface Props {
  zoom: Zoom;
  scale: Scale;
  today: string | undefined;
  nowX: number | null;
}

// Months or days on top; weeks, days or hours below; and a "Now" marker
export function TimelineHeader({ zoom, scale, today, nowX }: Props) {
  const t = useTranslations('Timeline');
  const format = useFormatter();
  const timeZoom = zoom === 'week' || zoom === 'day';

  const topLabel = (day: string, width: number) =>
    timeZoom
      ? format.dateTime(parseDay(day), { weekday: zoom === 'day' ? 'long' : 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      : format.dateTime(parseDay(day), { month: width > 0.12 ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' });

  const bottomLabel = (day: string, hour?: number) =>
    hour !== undefined ? `${String(hour).padStart(2, '0')}${zoom === 'day' ? ':00' : ''}` : String(parseDay(day).getUTCDate());

  return (
    <div className="flex border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
      <div
        data-label-column
        className="sticky left-0 z-20 flex w-(--label-width) shrink-0 items-end border-r border-slate-200 bg-slate-50 px-3 py-2 font-semibold uppercase tracking-wide sm:px-4"
      >
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
              zoom === 'month' && isWeekend(segment.day) ? 'text-slate-400' : ''
            } ${!timeZoom && segment.day === today ? 'font-bold text-indigo-600' : ''}`}
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
  );
}
