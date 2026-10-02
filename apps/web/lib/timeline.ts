import { containsText } from './text';

// Date math for the timeline and calendar. Days are "YYYY-MM-DD" strings and all math runs in UTC,
// so daylight saving and the browser's time zone can never shift a day.

export type Zoom = 'term' | 'month' | 'week' | 'day';
export type GroupBy = 'class' | 'teacher';

const DAY_MS = 86_400_000;

export const parseDay = (day: string) => new Date(`${day}T00:00:00Z`);
export const formatDay = (date: Date) => date.toISOString().slice(0, 10);
export const addDays = (day: string, days: number) => formatDay(new Date(parseDay(day).getTime() + days * DAY_MS));
export const diffDays = (from: string, to: string) => Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);

// ISO weekday: 1 = Monday … 7 = Sunday
export const isoWeekday = (day: string) => ((parseDay(day).getUTCDay() + 6) % 7) + 1;
export const isWeekend = (day: string) => isoWeekday(day) >= 6;
export const startOfWeek = (day: string) => addDays(day, 1 - isoWeekday(day));
export const startOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

export function addMonths(day: string, months: number) {
  const date = parseDay(startOfMonth(day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDay(date);
}

export const endOfMonth = (day: string) => addDays(addMonths(day, 1), -1);

export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export const daysInRange = (from: string, to: string) =>
  Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i));

// The school year's terms: Sep–Jan, Feb–Jun, and the summer
function termOf(day: string) {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (month >= 9) return { from: `${year}-09-01`, to: `${year + 1}-01-31` };
  if (month === 1) return { from: `${year - 1}-09-01`, to: `${year}-01-31` };
  if (month <= 6) return { from: `${year}-02-01`, to: `${year}-06-30` };
  return { from: `${year}-07-01`, to: `${year}-08-31` };
}

// The days a zoom level shows around the anchor day
export function rangeFor(zoom: Zoom, anchor: string) {
  switch (zoom) {
    case 'term':
      return termOf(anchor);
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    case 'week':
      return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 6) };
    case 'day':
      return { from: anchor, to: anchor };
  }
}

// The anchor for the previous (-1) or next (1) page
export function shiftAnchor(zoom: Zoom, anchor: string, direction: -1 | 1) {
  if (zoom === 'week') return addDays(anchor, 7 * direction);
  if (zoom === 'day') return addDays(anchor, direction);
  const { from, to } = rangeFor(zoom, anchor);
  return direction < 0 ? addDays(from, -1) : addDays(to, 1);
}

// The wall-clock day and time right now in a time zone, e.g. the school's
export function nowIn(timeZone: string, at = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map(({ type, value }) => [type, value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

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

// The hours a week or day view needs: the school day by default, wider when lessons fall outside it
export function hourWindow(times: { startTime: string; endTime: string }[]) {
  const starts = times.map(({ startTime }) => Math.floor(toMinutes(startTime) / 60));
  const ends = times.map(({ endTime }) => Math.ceil(toMinutes(endTime) / 60));
  return { startHour: Math.min(8, ...starts), endHour: Math.max(15, ...ends) };
}

// Where a bar from (day, minutes) to (day, minutes) goes, clipped to what's visible
export function barPosition(scale: Scale, start: { day: string; minutes?: number }, end: { day: string; minutes?: number }) {
  const first = scale.days[0]!;
  const last = scale.days.at(-1)!;
  const clippedStart = start.day < first;
  const clippedEnd = end.day > last;
  const left = clippedStart ? 0 : scale.x(start.day, start.minutes);
  const right = clippedEnd ? 1 : scale.x(end.day, end.minutes);
  if (left === null || right === null || right <= left) return null;
  return { left, width: right - left, clippedStart, clippedEnd };
}

interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TimelineItem {
  id: string;
  courseId: string;
  courseName: string;
  class: { id: string; name: string };
  teacher: Person;
  startDay: string;
  endDay: string;
  startTime?: string;
  endTime?: string;
  room?: string | null;
}

export interface TimelineRow {
  key: string;
  label: string;
  sublabel: string;
  items: TimelineItem[];
}

export interface TimelineGroup {
  key: string;
  label: string;
  colorKey: string;
  rows: TimelineRow[];
  items: TimelineItem[];
}

export const fullName = (person: Person) => `${person.firstName} ${person.lastName}`;

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

// Groups items into class (or teacher) groups, each with one row per course
export function groupItems(items: TimelineItem[], groupBy: GroupBy): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const item of items) {
    const byClass = groupBy === 'class';
    const groupKey = byClass ? item.class.id : item.teacher.id;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        label: byClass ? item.class.name : fullName(item.teacher),
        colorKey: byClass ? item.class.id : item.teacher.id,
        rows: [],
        items: [],
      };
      groups.set(groupKey, group);
    }
    group.items.push(item);

    let row = group.rows.find((r) => r.key === item.courseId);
    if (!row) {
      row = {
        key: item.courseId,
        label: item.courseName,
        sublabel: byClass ? fullName(item.teacher) : item.class.name,
        items: [],
      };
      group.rows.push(row);
    }
    row.items.push(item);
  }

  const sorted = [...groups.values()].sort((a, b) => collator.compare(a.label, b.label));
  for (const group of sorted) {
    group.rows.sort((a, b) => collator.compare(a.label, b.label) || collator.compare(a.sublabel, b.sublabel));
  }
  return sorted;
}

export const matchesSearch = (item: TimelineItem, search: string) =>
  containsText(`${item.courseName} ${item.class.name} ${fullName(item.teacher)}`, search);

// Splits multi-day events into one piece per calendar week and stacks overlapping pieces into lanes
export interface WeekPiece<T> {
  item: T;
  startColumn: number;
  endColumn: number;
  lane: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export function layoutWeek<T extends { startDate: string; endDate: string }>(weekStart: string, items: T[]) {
  const weekEnd = addDays(weekStart, 6);
  const pieces: WeekPiece<T>[] = [];
  const laneEnds: number[] = [];

  const inWeek = items
    .filter((item) => item.startDate <= weekEnd && item.endDate >= weekStart)
    // Earlier first, then longer first, so long events claim the top lanes
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.endDate.localeCompare(a.endDate));

  for (const item of inWeek) {
    const startColumn = item.startDate < weekStart ? 0 : diffDays(weekStart, item.startDate);
    const endColumn = item.endDate > weekEnd ? 6 : diffDays(weekStart, item.endDate);
    let lane = laneEnds.findIndex((end) => end < startColumn);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endColumn;
    pieces.push({
      item,
      startColumn,
      endColumn,
      lane,
      clippedStart: item.startDate < weekStart,
      clippedEnd: item.endDate > weekEnd,
    });
  }

  return { pieces, lanes: laneEnds.length };
}
