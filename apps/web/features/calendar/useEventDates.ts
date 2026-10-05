'use client';

import { useFormatter } from 'next-intl';
import { useCallback } from 'react';
import { parseDay } from '@/lib/dates/days';
import type { SchoolEvent } from '@/lib/types/school';

// "12 October 2026", or "21 – 23 October 2026" for an event over several days
export function useEventDates() {
  const format = useFormatter();
  return useCallback(
    (event: Pick<SchoolEvent, 'startDate' | 'endDate'>) => {
      const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const;
      return event.startDate === event.endDate
        ? format.dateTime(parseDay(event.startDate), options)
        : format.dateTimeRange(parseDay(event.startDate), parseDay(event.endDate), options);
    },
    [format],
  );
}
