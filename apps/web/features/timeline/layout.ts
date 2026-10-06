import type { Zoom } from './ranges';

// Width of the sticky label column: narrower on phones, so the bars keep most of the screen.
// Set as a CSS variable on the grid; the column and everything placed after it read it.
export const LABEL_WIDTH_CLASS = '[--label-width:9rem] sm:[--label-width:14rem]';
export const LABEL_WIDTH = 'var(--label-width)';

// How wide the time track is at least, before it scrolls sideways
export const MIN_TRACK_WIDTH: Record<Zoom, number> = { term: 980, month: 1100, week: 980, day: 800 };

// A 0–1 position as a CSS percentage
export const pct = (value: number) => `${value * 100}%`;
