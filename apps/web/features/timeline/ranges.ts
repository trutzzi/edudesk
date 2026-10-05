import { addDays, startOfMonth, endOfMonth, startOfWeek } from '@/lib/dates/days';

export type Zoom = 'term' | 'month' | 'week' | 'day';

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
