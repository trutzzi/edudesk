import { addDays, addMonths, daysInRange, diffDays, endOfMonth, isoWeekday, startOfMonth, startOfWeek } from '@/lib/dates/days';

export interface Segment {
  key: string;
  day: string;
  hour?: number;
  left: number;
  width: number;
}

// Maps a moment to a horizontal position from 0 (left edge) to 1 (right edge), or null when it's off screen
export interface Scale {
  x(day: string, minutes?: number): number | null;
  top: Segment[];
  bottom: Segment[];
  days: string[];
}

// Term and month views: the X axis is a run of whole days
export function dateScale(from: string, to: string, ticks: 'weeks' | 'days'): Scale {
  const total = diffDays(from, to) + 1;
  const days = daysInRange(from, to);
  const x = (day: string, minutes = 0) => {
    const value = (diffDays(from, day) + minutes / 1440) / total;
    return value < 0 || value > 1 ? null : value;
  };

  const top: Segment[] = [];
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) {
    const start = month < from ? from : month;
    const end = endOfMonth(month) > to ? to : endOfMonth(month);
    top.push({ key: month, day: month, left: x(start)!, width: (diffDays(start, end) + 1) / total });
  }

  const bottom =
    ticks === 'days'
      ? days.map((day) => ({ key: day, day, left: x(day)!, width: 1 / total }))
      : days
          .filter((day) => isoWeekday(day) === 1 || day === from)
          .map((day) => {
            const end = addDays(startOfWeek(day), 6) > to ? to : addDays(startOfWeek(day), 6);
            return { key: day, day, left: x(day)!, width: (diffDays(day, end) + 1) / total };
          });

  return { x, top, bottom, days };
}

// Week and day views: each visible day is split into the same window of hours
export function timeScale(days: string[], startHour: number, endHour: number): Scale {
  const span = (endHour - startHour) * 60;
  const width = 1 / days.length;
  const x = (day: string, minutes = startHour * 60) => {
    const index = days.indexOf(day);
    const offset = minutes - startHour * 60;
    if (index < 0 || offset < 0 || offset > span) return null;
    return (index * span + offset) / (days.length * span);
  };

  return {
    x,
    days,
    top: days.map((day, i) => ({ key: day, day, left: i * width, width })),
    bottom: days.flatMap((day, i) =>
      Array.from({ length: endHour - startHour }, (_, h) => ({
        key: `${day}-${h}`,
        day,
        hour: startHour + h,
        left: (i + h / (endHour - startHour)) * width,
        width: width / (endHour - startHour),
      })),
    ),
  };
}

// Where a bar from (day, minutes) to (day, minutes) goes, clipped to what's visible
export function barPosition(scale: Scale, start: { day: string; minutes?: number }, end: { day: string; minutes?: number }) {
  const first = scale.days[0];
  const last = scale.days.at(-1)!;
  const clippedStart = start.day < first;
  const clippedEnd = end.day > last;
  const left = clippedStart ? 0 : scale.x(start.day, start.minutes);
  const right = clippedEnd ? 1 : scale.x(end.day, end.minutes);
  if (left === null || right === null || right <= left) return null;
  return { left, width: right - left, clippedStart, clippedEnd };
}
