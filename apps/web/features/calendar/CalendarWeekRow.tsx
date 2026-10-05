'use client';

import { useTranslations } from 'next-intl';
import { EVENT_COLORS } from '@/lib/colors';
import { addDays, parseDay } from '@/lib/dates/days';
import type { SchoolEvent } from '@/lib/types/school';
import { useEventTitle } from '@/lib/useEventTitle';
import { COLUMNS, LANE_HEIGHT } from './layout';
import { useEventDates } from './useEventDates';
import { layoutWeek } from './weekLayout';

interface Props {
  weekStart: string;
  // The first day of the month on screen; other days are faded
  month: string;
  today: string;
  events: SchoolEvent[];
  onSelect: (event: SchoolEvent) => void;
}

// One week: the day cells, with the week's events laid over them as bars in stacked lanes
export function CalendarWeekRow({ weekStart, month, today, events, onSelect }: Props) {
  const t = useTranslations('Calendar');
  const eventTitle = useEventTitle();
  const eventDates = useEventDates();
  const { pieces, lanes } = layoutWeek(weekStart, events);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="relative">
      <div className="grid gap-2" style={{ gridTemplateColumns: COLUMNS }}>
        {days.map((day, i) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              className={`rounded-lg border-b-4 px-2 pt-1.5 ${i >= 5 ? 'border-slate-100 bg-slate-50/70' : 'border-slate-200 bg-slate-50/30'} ${
                day.slice(0, 7) !== month.slice(0, 7) ? 'opacity-40' : ''
              }`}
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
              onClick={() => onSelect(item)}
              title={`${eventTitle(item)} · ${eventDates(item)}`}
              className={`pointer-events-auto mb-1 flex min-w-0 items-center gap-1.5 overflow-hidden border border-black/5 py-0.5 pl-0.5 pr-2 text-left text-xs font-semibold shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${color.soft} ${color.text} ${
                clippedStart ? 'rounded-l-none border-l-0' : 'rounded-l-full'
              } ${clippedEnd ? 'rounded-r-none border-r-0' : 'rounded-r-full'}`}
              style={{ gridColumn: `${startColumn + 1} / ${endColumn + 2}`, gridRow: lane + 1 }}
            >
              {/* The round badge: the class, or the event type's initial for the whole school */}
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
}
