'use client';

import { useTranslations } from 'next-intl';
import { EVENT_COLORS } from '@/lib/colors';
import type { SchoolEvent } from '@/lib/types/school';
import { useEventTitle } from '@/lib/useEventTitle';
import { useEventDates } from './useEventDates';

interface Props {
  // The month's events, in date order
  events: SchoolEvent[];
  onSelect: (event: SchoolEvent) => void;
}

// Phones: the month as a list of its events, instead of a grid too wide for the screen
export function CalendarAgenda({ events, onSelect }: Props) {
  const t = useTranslations('Calendar');
  const eventTitle = useEventTitle();
  const eventDates = useEventDates();

  return (
    <ul aria-label={t('agenda')} className="space-y-2">
      {events.map((event) => {
        const color = EVENT_COLORS[event.kind];
        return (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => onSelect(event)}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition active:bg-slate-50"
            >
              <span className={`h-10 w-1.5 shrink-0 rounded-full ${color.bar}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{eventTitle(event)}</span>
                <span className="block text-sm text-slate-500">{eventDates(event)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${color.soft} ${color.text}`}>
                {event.class?.name ?? t(`kinds.${event.kind}`)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
