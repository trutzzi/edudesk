import type { Zoom } from './ranges';

// Width of the sticky label column, in px (Tailwind w-56)
export const LABEL_WIDTH = 224;

// How wide the time track is at least, before it scrolls sideways
export const MIN_TRACK_WIDTH: Record<Zoom, number> = { term: 980, month: 1100, week: 980, day: 800 };

// A 0–1 position as a CSS percentage
export const pct = (value: number) => `${value * 100}%`;
