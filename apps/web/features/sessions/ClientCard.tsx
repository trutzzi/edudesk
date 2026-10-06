'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { callHref, whatsappHref } from '@/lib/contact';
import { nowIn } from '@/lib/dates/clock';
import { endOfMonth } from '@/lib/dates/days';
import { fullName } from '@/lib/people';
import { browserTimeZone } from '@/lib/useNow';
import { formatHours, formatLongDay, formatMonth, shiftMonth } from './format';
import { StatusBadge } from './StatusBadge';
import { ATTENDANCE_STATUSES, type ClientProfile, type ClientSession } from './types';

// A client's card: how to reach them, how their therapy is paid for, and their sessions month by month.
// Staff see any client they work with; a client sees their own (without the contact buttons or payment).
export function ClientCard({ clientId }: { clientId: string }) {
  const t = useTranslations('ClientCard');
  const tStatus = useTranslations('Attendance.statuses');
  const tPayment = useTranslations('PaymentTypes');
  const locale = useLocale();
  const { user } = useAuth();
  const isStaff = user?.role === 'school_admin' || user?.role === 'teacher';
  const thisMonth = nowIn(browserTimeZone()).day.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const profile = useApi<ClientProfile>(`/api/clients/${clientId}`);
  const sessions = useApi<ClientSession[]>(`/api/clients/${clientId}/sessions?from=${month}-01&to=${endOfMonth(`${month}-01`)}`);

  const summary = useMemo(() => {
    const rows = sessions.data ?? [];
    const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, rows.filter((row) => row.status === status).length]));
    const hours = rows.filter((row) => row.status === 'present').reduce((sum, row) => sum + row.hours, 0);
    return { counts, hours, total: rows.length };
  }, [sessions.data]);

  // Newest first, one group per day
  const days = useMemo(() => {
    const byDay = new Map<string, ClientSession[]>();
    for (const row of sessions.data ?? []) byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);
    return [...byDay.entries()].reverse();
  }, [sessions.data]);

  if (profile.error !== undefined) return <ErrorAlert>{t('notFound')}</ErrorAlert>;
  if (!profile.data) return <Skeleton className="h-48 rounded-2xl bg-slate-200" />;
  const client = profile.data;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fullName(client)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[client.rooms.map((room) => room.name).join(', '), client.email].filter(Boolean).join(' · ')}
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('phone')}</dt>
            <dd className="mt-0.5 font-medium">{client.phone ?? t('noPhone')}</dd>
          </div>
          {isStaff && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('paymentType')}</dt>
              <dd className="mt-0.5 font-medium">{client.paymentType ? tPayment(client.paymentType) : t('noPaymentType')}</dd>
            </div>
          )}
        </dl>
        {(client.details || client.notes) && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {client.details && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('details')}</dt>
                <dd className="mt-0.5 whitespace-pre-line">{client.details}</dd>
              </div>
            )}
            {client.notes && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('notes')}</dt>
                <dd className="mt-0.5 whitespace-pre-line">{client.notes}</dd>
              </div>
            )}
          </dl>
        )}
        {isStaff && client.phone && (
          <div className="flex flex-wrap gap-2">
            <a href={callHref(client.phone)} className={buttonClass()}>
              {t('call')}
            </a>
            <a href={whatsappHref(client.phone)} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
              {t('whatsapp')}
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-4">
        <h2 id="history-title" className="sr-only">
          {t('history')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodNav
            label={formatMonth(month, locale)}
            todayLabel={t('thisMonth')}
            onToday={() => setMonth(thisMonth)}
            onPrevious={() => setMonth(shiftMonth(month, -1))}
            onNext={() => setMonth(shiftMonth(month, 1))}
          />
        </div>

        {sessions.error !== undefined ? (
          <ErrorAlert>{t('loadError')}</ErrorAlert>
        ) : !sessions.data ? (
          <Skeleton className="h-40 rounded-2xl bg-slate-200" />
        ) : sessions.data.length === 0 ? (
          <InfoNote>{t('noSessions')}</InfoNote>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                [t('sessions'), summary.total],
                [t('hours'), formatHours(summary.hours, locale)],
                ...ATTENDANCE_STATUSES.map((status) => [tStatus(status), summary.counts[status] ?? 0] as const),
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <dt className="text-xs font-medium text-slate-500">{label}</dt>
                  <dd className="text-xl font-bold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3">
              {days.map(([date, rows]) => (
                <article key={date} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 text-sm font-bold first-letter:uppercase">{formatLongDay(date, locale)}</h3>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <li key={`${row.courseId}|${row.startTime}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                        <span className="font-mono text-slate-500">
                          {row.startTime}–{row.endTime}
                        </span>
                        <span className="font-semibold">{row.courseName}</span>
                        <span className="min-w-0 flex-1 text-slate-500">
                          {fullName(row.teacher)} · {row.class.name}
                        </span>
                        <StatusBadge status={row.status} />
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
