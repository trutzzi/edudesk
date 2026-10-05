'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { LEVEL_STYLE, type Bucket } from './types';

const CHART_HEIGHT = 140;

// The smallest "clean" axis maximum at or above the data: 1, 2, 5, 10, 20, 50…
function niceMax(value: number) {
  if (value <= 1) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * magnitude).find((candidate) => candidate >= value)!;
}

// Stacked columns of errors (on the baseline) and warnings, one per hour or day.
// Hover or focus a column for its numbers; screen readers get the same data as a table.
export function ProblemsChart({ buckets, byDay }: { buckets: Bucket[]; byDay: boolean }) {
  const t = useTranslations('Health');
  const format = useFormatter();
  const max = niceMax(Math.max(0, ...buckets.map(({ errors, warnings }) => errors + warnings)));
  const toHeight = (count: number) => (count / max) * CHART_HEIGHT;

  const label = (start: string) =>
    byDay ? format.dateTime(new Date(start), { weekday: 'short', day: 'numeric' }) : format.dateTime(new Date(start), { hour: 'numeric' });
  // Hours are labelled every 6, days all
  const showTick = (index: number) => byDay || index % 6 === 0;
  const totals = buckets.reduce((sum, { errors, warnings }) => ({ errors: sum.errors + errors, warnings: sum.warnings + warnings }), {
    errors: 0,
    warnings: 0,
  });

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{byDay ? t('chartDay') : t('chartHour')}</span>
        {/* The key is the level's icon in its colour, so shape repeats what colour says */}
        <span className="flex gap-4 text-xs text-slate-600">
          {(['error', 'warn'] as const).map((level) => (
            <span key={level} className="flex items-center gap-1.5">
              <span aria-hidden className={`text-sm leading-none ${LEVEL_STYLE[level].text}`}>
                {LEVEL_STYLE[level].icon}
              </span>
              {level === 'error' ? t('errorsSeries') : t('warningsSeries')}
            </span>
          ))}
        </span>
      </figcaption>

      <div className="flex gap-2">
        {/* Y axis: 0, half and the maximum */}
        <div
          aria-hidden
          className="relative w-6 shrink-0 text-right text-[11px] tabular-nums text-slate-400"
          style={{ height: CHART_HEIGHT }}
        >
          {[max, max / 2, 0].map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: CHART_HEIGHT - toHeight(tick) }}>
              {Number.isInteger(tick) ? tick : ''}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {[max, max / 2, 0].map((tick) => (
            <div
              key={tick}
              aria-hidden
              className={`absolute inset-x-0 h-px ${tick === 0 ? 'bg-slate-300' : 'bg-slate-100'}`}
              style={{ top: CHART_HEIGHT - toHeight(tick) }}
            />
          ))}

          <div className="relative flex items-end" style={{ height: CHART_HEIGHT }}>
            {buckets.map((bucket) => {
              const total = bucket.errors + bucket.warnings;
              return (
                <div
                  key={bucket.start}
                  tabIndex={0}
                  role="img"
                  aria-label={t('bucket', { time: label(bucket.start), errors: bucket.errors, warnings: bucket.warnings })}
                  className="group relative flex h-full flex-1 items-end justify-center outline-none focus-visible:bg-indigo-50"
                >
                  {total > 0 && (
                    // 2px surface gap between the segments; only the top end is rounded
                    <div className="flex w-[70%] max-w-6 flex-col-reverse gap-0.5">
                      {bucket.errors > 0 && (
                        <div
                          className={`${LEVEL_STYLE.error.bar} ${bucket.warnings === 0 ? 'rounded-t' : ''}`}
                          style={{ height: toHeight(bucket.errors) }}
                        />
                      )}
                      {bucket.warnings > 0 && (
                        <div className={`${LEVEL_STYLE.warn.bar} rounded-t`} style={{ height: toHeight(bucket.warnings) }} />
                      )}
                    </div>
                  )}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block group-focus-visible:block"
                  >
                    <p className="font-semibold">{label(bucket.start)}</p>
                    <p>
                      {LEVEL_STYLE.error.icon} {t('errors')}: {bucket.errors}
                    </p>
                    <p>
                      {LEVEL_STYLE.warn.icon} {t('warnings')}: {bucket.warnings}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div aria-hidden className="mt-1 flex text-[11px] tabular-nums text-slate-400">
            {buckets.map((bucket, index) => (
              <span key={bucket.start} className="flex-1 text-center">
                {showTick(index) ? label(bucket.start) : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The same data for screen readers */}
      <table className="sr-only">
        <caption>{t('chartSummary', totals)}</caption>
        <thead>
          <tr>
            <th>{t('time')}</th>
            <th>{t('errors')}</th>
            <th>{t('warnings')}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.start}>
              <td>{label(bucket.start)}</td>
              <td>{bucket.errors}</td>
              <td>{bucket.warnings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
