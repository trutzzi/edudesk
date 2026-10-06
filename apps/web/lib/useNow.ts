'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { nowIn } from '@/lib/dates/clock';

const TICK_MS = 15_000;

const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, TICK_MS);
  return () => clearInterval(id);
};

// The current day and minute in `timeZone`, re-rendering when the minute changes.
// null on the server, where "now" would differ from the browser's and break hydration.
export function useNow(timeZone: string) {
  // A string snapshot only changes once a minute, so React skips the renders in between
  const getSnapshot = useCallback(() => {
    const { day, minutes } = nowIn(timeZone);
    return `${day}|${minutes}`;
  }, [timeZone]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);

  return useMemo(() => {
    if (!snapshot) return null;
    const [day, minutes] = snapshot.split('|');
    return { day: day, minutes: Number(minutes) };
  }, [snapshot]);
}

// The browser's own time zone, used until the school's is known
export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
