'use client';

export interface Segment<T extends string> {
  value: T;
  label: string;
  // When the visible label is an abbreviation (e.g. "RO"), the full name for screen readers and tooltips
  fullLabel?: string;
  lang?: string;
}

interface Props<T extends string> {
  // Names the group for screen readers
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm';
}

// A row of toggle buttons where exactly one is on: the language switch, Day/Week/Month, log filters
export function SegmentedControl<T extends string>({ label, segments, value, onChange, disabled, size = 'sm' }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex rounded-lg border border-slate-200 bg-white p-0.5 font-semibold ${size === 'xs' ? 'text-xs' : 'text-sm'} ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            lang={segment.lang}
            title={segment.fullLabel}
            aria-label={segment.fullLabel}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => !active && onChange(segment.value)}
            className={`rounded-md transition ${size === 'xs' ? 'px-2.5 py-1' : 'px-3 py-1'} ${
              active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
