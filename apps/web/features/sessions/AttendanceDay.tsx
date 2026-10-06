'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { PeriodNav } from '@/components/ui/PeriodNav';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { nowIn } from '@/lib/dates/clock';
import { addDays } from '@/lib/dates/days';
import { browserTimeZone } from '@/lib/useNow';
import { fullName } from '@/lib/people';
import { formatLongDay } from './format';
import { STATUS_STYLES } from './StatusBadge';
import { ATTENDANCE_STATUSES, type AttendanceDay as Day, type AttendanceStatus, type Neighbour, type Roster } from './types';

// A day of sessions, each with its clients: the therapist marks who came. Everyone counts as present until marked.
export function AttendanceDay() {
  const t = useTranslations('Attendance');
  const locale = useLocale();
  const { user } = useAuth();
  const [date, setDate] = useState(() => nowIn(browserTimeZone()).day);
  const day = useApi<Day>(`/api/attendance?date=${date}`);
  const { send, pending, error } = useSend();

  async function mark(session: Roster, studentId: string, status: AttendanceStatus) {
    const body = { courseId: session.courseId, date: session.date, startTime: session.startTime, studentId, status };
    if ((await send('/api/attendance', { body })).ok) day.reload();
  }

  const neighbour = (label: string, other: Neighbour | null) =>
    other && (
      <span>
        {label}: <span className="font-medium text-slate-700">{other.courseName}</span> {other.startTime}–{other.endTime} ·{' '}
        {fullName(other.teacher)}
      </span>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodNav
          label={formatLongDay(date, locale)}
          onToday={() => setDate(day.data?.today ?? nowIn(browserTimeZone()).day)}
          onPrevious={() => setDate(addDays(date, -1))}
          onNext={() => setDate(addDays(date, 1))}
        />
      </div>

      <FormError message={error} />
      {day.error !== undefined ? (
        <ErrorAlert>{t('loadError')}</ErrorAlert>
      ) : !day.data || day.data.date !== date ? (
        <Skeleton className="h-48 rounded-2xl bg-slate-200" />
      ) : day.data.sessions.length === 0 ? (
        <InfoNote>{t('noSessions')}</InfoNote>
      ) : (
        <>
          {!day.data.editable && <InfoNote>{t('future')}</InfoNote>}
          {day.data.sessions.map((session) => (
            <article
              key={`${session.courseId}|${session.startTime}`}
              aria-label={`${session.startTime} ${session.courseName}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-sm text-slate-500">
                  {session.startTime}–{session.endTime}
                </span>
                <h2 className="text-lg font-bold">{session.courseName}</h2>
                <span className="text-sm text-slate-500">
                  {session.class.name}
                  {user?.role !== 'teacher' && ` · ${fullName(session.teacher)}`}
                </span>
              </header>
              {session.clients.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t('noClients')}</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {session.clients.map(({ client, status, before, after }) => (
                    <li key={client.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/dashboard/clients/${client.id}`} className="font-medium text-indigo-700 hover:underline">
                          {fullName(client)}
                        </Link>
                        <p className="flex flex-col text-xs text-slate-500 sm:flex-row sm:gap-3">
                          {neighbour(t('before'), before)}
                          {neighbour(t('after'), after)}
                        </p>
                      </div>
                      <select
                        value={status}
                        onChange={(event) => mark(session, client.id, event.target.value as AttendanceStatus)}
                        disabled={!day.data?.editable || pending}
                        aria-label={t('statusFor', { name: fullName(client) })}
                        className={`${compactControlClass} font-semibold ${STATUS_STYLES[status]} w-full sm:w-auto`}
                      >
                        {ATTENDANCE_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {t(`statuses.${value}`)}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </>
      )}
    </div>
  );
}
