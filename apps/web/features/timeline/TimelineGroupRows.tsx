'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { LiveDot } from '@/components/ui/LiveDot';
import { colorFor } from '@/lib/colors';
import { parseDay } from '@/lib/dates/days';
import { fullName } from '@/lib/people';
import { isItemLive, itemPosition } from './bars';
import type { TimelineGroup, TimelineItem } from './grouping';
import { pct } from './layout';
import type { Zoom } from './ranges';
import type { Scale } from './scales';

interface Props {
  group: TimelineGroup;
  open: boolean;
  onToggle: () => void;
  zoom: Zoom;
  scale: Scale;
  now: { day: string; minutes: number } | null;
  liveCourseIds: Set<string>;
}

// One class (or teacher): a summary row that folds open into a row per course
export function TimelineGroupRows({ group, open, onToggle, zoom, scale, now, liveCourseIds }: Props) {
  const t = useTranslations('Timeline');
  const format = useFormatter();
  const color = colorFor(group.colorKey);
  const timeZoom = zoom === 'week' || zoom === 'day';

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

  const barLabel = (item: TimelineItem) => {
    if (!timeZoom) return item.courseName;
    return zoom === 'day' ? `${item.startTime} · ${item.room ?? ''}` : '';
  };

  return (
    <div role="rowgroup">
      <div className="relative flex border-b border-slate-100 bg-slate-50/60">
        <div className="sticky left-0 z-20 flex w-56 shrink-0 items-center gap-2 border-r border-slate-200 bg-slate-50 px-2 py-2">
          <button
            type="button"
            onClick={onToggle}
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
        {/* A faint summary of everything in the group */}
        <div className="relative h-10 flex-1">
          {group.items.map((item) => {
            const position = itemPosition(scale, item);
            return (
              position && (
                <div
                  key={item.id}
                  className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-50 ${color.bar}`}
                  style={{ left: pct(position.left), width: pct(position.width) }}
                />
              )
            );
          })}
        </div>
      </div>

      {open &&
        group.rows.map((row) => (
          <div key={row.key} className="relative flex border-b border-slate-100 hover:bg-indigo-50/30">
            <div className="sticky left-0 z-20 flex w-56 shrink-0 items-center gap-2 border-r border-slate-200 bg-white py-2 pl-10 pr-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{row.label}</p>
                <p className="truncate text-xs text-slate-500">{row.sublabel}</p>
              </div>
              {liveCourseIds.has(row.key) && (
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase text-emerald-600">
                  <LiveDot />
                  <span className="sr-only sm:not-sr-only">{t('inProgress')}</span>
                </span>
              )}
            </div>
            <div className="relative h-12 flex-1">
              {row.items.map((item) => {
                const position = itemPosition(scale, item);
                if (!position) return null;
                return (
                  <div
                    key={item.id}
                    role="img"
                    aria-label={describe(item)}
                    title={describe(item)}
                    className={`absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden px-2 text-[11px] font-semibold text-white shadow-sm ${color.bar} ${
                      timeZoom
                        ? 'rounded-md'
                        : `${position.clippedStart ? '' : 'rounded-l-full'} ${position.clippedEnd ? '' : 'rounded-r-full'}`
                    } ${isItemLive(item, now) ? 'ring-2 ring-indigo-600 ring-offset-1' : ''}`}
                    style={{ left: pct(position.left), width: pct(position.width) }}
                  >
                    <span className="truncate">{barLabel(item)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
