'use client';

import { HOLIDAY_STRIPES } from '@/lib/colors';
import { isWeekend } from '@/lib/dates/days';
import type { SchoolEvent } from '@/lib/types/school';
import { useEventTitle } from '@/lib/useEventTitle';
import { LABEL_WIDTH, pct } from './layout';
import type { Zoom } from './ranges';
import type { Scale } from './scales';

// Behind the rows: whole-school holidays striped, weekends shaded in the month view, and the grid lines
export function TimelineBackground({ zoom, scale, events }: { zoom: Zoom; scale: Scale; events: SchoolEvent[] }) {
  const eventTitle = useEventTitle();
  const dayWidth = 1 / scale.days.length;
  const holidays = events.filter((event) => event.kind === 'holiday' && !event.class);

  const shaded = scale.days.flatMap((day, index) => {
    const holiday = holidays.find((event) => event.startDate <= day && day <= event.endDate);
    if (holiday) return [{ day, index, title: eventTitle(holiday), holiday: true }];
    if (zoom === 'month' && isWeekend(day)) return [{ day, index, title: '', holiday: false }];
    return [];
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_WIDTH }}>
      {shaded.map(({ day, index, title, holiday }) => (
        <div
          key={day}
          title={title}
          className={`absolute inset-y-0 ${holiday ? `bg-rose-50 ${HOLIDAY_STRIPES}` : 'bg-slate-50'}`}
          style={{ left: pct(index * dayWidth), width: pct(dayWidth) }}
        />
      ))}
      {scale.bottom.map((segment) => (
        <div
          key={segment.key}
          className={`absolute inset-y-0 border-l ${
            segment.hour === undefined || segment.hour === scale.bottom[0].hour ? 'border-slate-200' : 'border-slate-100'
          }`}
          style={{ left: pct(segment.left) }}
        />
      ))}
    </div>
  );
}
