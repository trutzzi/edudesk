import { addDays, diffDays } from '@/lib/dates/days';

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
