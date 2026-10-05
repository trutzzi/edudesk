'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { LogList } from './LogList';
import { ProblemsChart } from './ProblemsChart';
import { LEVEL_STYLE, type Summary } from './types';

type Range = '24h' | '7d';
const REFRESH_EVERY_MS = 60_000;

function Tile({ label, children, icon }: { label: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
        {icon}
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// For admins: how the API and web app are doing, from the problems they've logged
export function SystemHealth() {
  const t = useTranslations('Health');
  const format = useFormatter();
  const [range, setRange] = useState<Range>('24h');
  // Bumped by "Refresh" so the log starts again from the newest entry
  const [refreshKey, setRefreshKey] = useState(0);
  const summary = useApi<Summary>(`/api/monitoring/summary?range=${range}`);
  const { reload } = summary;

  // Keeps the numbers current while the page is open
  useEffect(() => {
    const id = setInterval(reload, REFRESH_EVERY_MS);
    return () => clearInterval(id);
  }, [reload]);

  const refresh = () => {
    reload();
    setRefreshKey((key) => key + 1);
  };

  const uptime = (seconds: number) => {
    const unit = seconds >= 86_400 ? 'day' : seconds >= 3600 ? 'hour' : 'minute';
    const value = Math.floor(seconds / { day: 86_400, hour: 3600, minute: 60 }[unit]);
    return format.number(value, { style: 'unit', unit, unitDisplay: 'long' });
  };

  const data = summary.data;

  return (
    <section aria-labelledby="health-title" className="space-y-4">
      <div>
        <h2 id="health-title" className="text-xl font-bold tracking-tight">
          {t('title')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label={t('range')}
          value={range}
          onChange={(event) => setRange(event.target.value as Range)}
          className={compactControlClass}
        >
          <option value="24h">{t('range24h')}</option>
          <option value="7d">{t('range7d')}</option>
        </select>
        <button type="button" onClick={refresh} disabled={summary.loading} className={buttonClass('secondary', 'sm')}>
          {t('refresh')}
        </button>
        {data && !summary.loading && (
          <span className="text-xs text-slate-500" aria-live="polite">
            {t('updated', { time: format.dateTime(new Date(data.generatedAt), { hour: '2-digit', minute: '2-digit' }) })}
          </span>
        )}
      </div>

      {summary.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : !data ? (
        <Skeleton className="h-64 rounded-2xl bg-slate-200" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Tile
              label={t('errors')}
              icon={
                <span aria-hidden className={LEVEL_STYLE.error.text}>
                  {LEVEL_STYLE.error.icon}
                </span>
              }
            >
              <p className="text-3xl font-semibold">{format.number(data.totals.errors)}</p>
            </Tile>
            <Tile
              label={t('warnings')}
              icon={
                <span aria-hidden className={LEVEL_STYLE.warn.text}>
                  {LEVEL_STYLE.warn.icon}
                </span>
              }
            >
              <p className="text-3xl font-semibold">{format.number(data.totals.warnings)}</p>
            </Tile>
            <Tile label={t('slow')}>
              <p className="text-3xl font-semibold">{format.number(data.totals.slow)}</p>
            </Tile>
            <Tile label={t('web')}>
              <p className="text-3xl font-semibold">{format.number(data.totals.webErrors)}</p>
            </Tile>
            <Tile label={t('server')}>
              <p className="text-sm font-semibold text-slate-800">{t('uptime', { duration: uptime(data.server.uptimeSeconds) })}</p>
              <p className="text-xs text-slate-500">{t('database', { ms: data.server.dbLatencyMs })}</p>
              <p className="text-xs text-slate-500">{t('memory', { mb: data.server.memoryMb })}</p>
            </Tile>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <ProblemsChart buckets={data.timeline} byDay={range === '7d'} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">{t('top')}</h3>
              {data.topPaths.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">{t('none')}</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">{t('endpoint')}</th>
                      <th className="pb-2 text-right font-medium">{t('usualStatus')}</th>
                      <th className="pb-2 text-right font-medium">{t('problems')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.topPaths.map((row) => (
                      <tr key={`${row.method} ${row.path}`}>
                        <td className="break-all py-2 pr-3 font-mono text-xs text-slate-700">
                          {row.method} {row.path}
                        </td>
                        <td className="py-2 text-right font-mono text-xs text-slate-600">{row.commonStatus}</td>
                        <td className="py-2 text-right tabular-nums">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <LogList refreshKey={refreshKey} />
      </div>
    </section>
  );
}
