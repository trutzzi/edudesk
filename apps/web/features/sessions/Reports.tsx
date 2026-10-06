'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/lib/api/useApi';
import { nowIn } from '@/lib/dates/clock';
import { fullName } from '@/lib/people';
import { browserTimeZone } from '@/lib/useNow';
import { formatHours, formatMonth, shiftMonth } from './format';
import { ATTENDANCE_STATUSES, type Report } from './types';

const cellClass = 'px-3 py-2 text-right tabular-nums';
const headClass = 'px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500';

// One month: per client, their sessions, hours and attendance; per therapist, the hours they held.
// Admins see everyone; a therapist sees their clients and their own hours.
export function Reports() {
  const t = useTranslations('Reports');
  const tStatus = useTranslations('Attendance.statuses');
  const locale = useLocale();
  const thisMonth = nowIn(browserTimeZone()).day.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const report = useApi<Report>(`/api/reports?month=${month}`);
  const hours = (value: number) => formatHours(value, locale);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={formatMonth(month, locale)}
          todayLabel={t('thisMonth')}
          onToday={() => setMonth(thisMonth)}
          onPrevious={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
        />
      </div>

      {report.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : !report.data || report.data.month !== month ? (
        <Skeleton className="h-64 rounded-2xl bg-slate-200" />
      ) : report.data.clients.length === 0 ? (
        <InfoNote>{t('empty')}</InfoNote>
      ) : (
        <>
          <section aria-labelledby="therapists-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="therapists-title" className="mb-3 text-lg font-bold">
              {t('therapists')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={`${headClass} text-left`}>{t('therapist')}</th>
                    <th className={headClass}>{t('sessionsHeld')}</th>
                    <th className={headClass}>{t('hoursWorked')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.data.therapists.map((row) => (
                    <tr key={row.teacher.id}>
                      <td className="px-3 py-2 font-medium">{fullName(row.teacher)}</td>
                      <td className={cellClass}>{row.sessions}</td>
                      <td className={`${cellClass} font-semibold`}>{hours(row.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t('hoursNote')}</p>
          </section>

          <section aria-labelledby="clients-title" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 id="clients-title" className="mb-3 text-lg font-bold">
              {t('clients')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className={`${headClass} text-left`}>{t('client')}</th>
                    <th className={`${headClass} text-left`}>{t('therapies')}</th>
                    <th className={headClass}>{t('sessions')}</th>
                    <th className={headClass}>{t('hours')}</th>
                    {ATTENDANCE_STATUSES.map((status) => (
                      <th key={status} className={headClass}>
                        {tStatus(status)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.data.clients.map((row) => (
                    <tr key={row.client.id}>
                      <td className="px-3 py-2">
                        <Link href={`/dashboard/clients/${row.client.id}`} className="font-medium text-indigo-700 hover:underline">
                          {fullName(row.client)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{row.therapies.join(', ')}</td>
                      <td className={cellClass}>{row.sessions}</td>
                      <td className={`${cellClass} font-semibold`}>{hours(row.hours)}</td>
                      {ATTENDANCE_STATUSES.map((status) => (
                        <td key={status} className={`${cellClass} ${row.counts[status] === 0 ? 'text-slate-300' : ''}`}>
                          {row.counts[status]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
