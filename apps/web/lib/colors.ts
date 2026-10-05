// Full class names (not built from pieces), so Tailwind finds them when it scans the code
const PALETTE = [
  { bar: 'bg-sky-400', soft: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  { bar: 'bg-emerald-400', soft: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bar: 'bg-violet-400', soft: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bar: 'bg-amber-400', soft: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bar: 'bg-rose-400', soft: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bar: 'bg-teal-400', soft: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
  { bar: 'bg-indigo-400', soft: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bar: 'bg-orange-400', soft: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
];

export type Color = (typeof PALETTE)[number];

// The same key always gets the same color, whatever else is on screen
export function colorFor(key: string): Color {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export const EVENT_COLORS = {
  holiday: { bar: 'bg-rose-500', soft: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  exam: { bar: 'bg-amber-500', soft: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  trip: { bar: 'bg-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  meeting: { bar: 'bg-sky-600', soft: 'bg-sky-50', text: 'text-sky-700', dot: 'bg-sky-600' },
  other: { bar: 'bg-slate-500', soft: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-500' },
} as const;

export type EventKind = keyof typeof EVENT_COLORS;
export const EVENT_KINDS = Object.keys(EVENT_COLORS) as EventKind[];

// Different colors for everything on one screen (up to the palette size), always in the same order
export function distinctColors(keys: string[]) {
  const unique = [...new Set(keys)].sort();
  return new Map(unique.map((key, i) => [key, i < PALETTE.length ? PALETTE[i]! : colorFor(key)]));
}

// Diagonal rose stripes marking a holiday, in the timeline and timetables (a full class name, for Tailwind)
export const HOLIDAY_STRIPES = 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(254_205_211/0.5)_6px_8px)]';
