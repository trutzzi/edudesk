import { toMinutes } from '@/lib/dates/time';
import type { TimelineItem } from './grouping';
import { barPosition, type Scale } from './scales';

type Now = { day: string; minutes: number } | null;

// Where an item's bar goes: a lesson by its times, a course across whole days
export const itemPosition = (scale: Scale, item: TimelineItem) =>
  item.startTime
    ? barPosition(
        scale,
        { day: item.startDay, minutes: toMinutes(item.startTime) },
        { day: item.endDay, minutes: toMinutes(item.endTime!) },
      )
    : barPosition(scale, { day: item.startDay }, { day: item.endDay, minutes: 1440 });

export const isItemLive = (item: TimelineItem, now: Now) =>
  Boolean(
    now &&
    item.startTime &&
    item.startDay === now.day &&
    toMinutes(item.startTime) <= now.minutes &&
    now.minutes < toMinutes(item.endTime!),
  );
