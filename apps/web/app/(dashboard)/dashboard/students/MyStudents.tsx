'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { colorFor } from '@/lib/colors';
import { useApi } from '@/lib/useApi';
import { InvitationList } from '../people/InvitationList';
import { InviteForm } from '../people/InviteForm';
import type { Invitation } from '../people/types';
import type { Person } from '../classes/types';

interface TaughtClass {
  id: string;
  name: string;
  schoolYear: string;
  students: Person[];
}

// A teacher's classes and the students in them, plus inviting new students into those classes
export function MyStudents() {
  const t = useTranslations('MyStudents');
  const tPeople = useTranslations('People');
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const classes = useApi<TaughtClass[]>(isTeacher ? '/api/classes/taught' : null);
  const invitations = useApi<Invitation[]>(isTeacher ? '/api/invitations' : null);

  const [inviting, setInviting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (!isTeacher) return <InfoNote>{t('noClasses')}</InfoNote>;
  if (classes.error !== undefined) return <ErrorAlert>{t('loadError')}</ErrorAlert>;
  if (!classes.data) return <div aria-hidden className="h-48 animate-pulse rounded-2xl bg-slate-200" />;
  if (classes.data.length === 0) return <InfoNote>{t('noClasses')}</InfoNote>;

  return (
    <div className="space-y-6">
      {inviting ? (
        <InviteForm
          classes={classes.data}
          students={[]}
          roles={['student']}
          requireClass
          onCancel={() => setInviting(false)}
          onSent={(email) => {
            setInviting(false);
            setSentTo(email);
            invitations.reload();
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setInviting(true);
            }}
            className={buttonClass()}
          >
            + {t('invite')}
          </button>
          {sentTo && (
            <p role="status" className="text-sm font-medium text-emerald-700">
              ✓ {tPeople('sent', { email: sentTo })}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="classes-title" className="space-y-4">
          <h2 id="classes-title" className="sr-only">
            {t('classes')}
          </h2>
          {classes.data.map((schoolClass) => (
            <article
              key={schoolClass.id}
              aria-labelledby={`class-${schoolClass.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${colorFor(schoolClass.id).dot}`} />
                <h3 id={`class-${schoolClass.id}`} className="text-lg font-bold">
                  {schoolClass.name}
                </h3>
                <span className="text-sm text-slate-400">
                  {schoolClass.schoolYear} · {schoolClass.students.length}
                </span>
              </div>
              {schoolClass.students.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t('noStudents')}</p>
              ) : (
                <ul className="mt-3 grid gap-x-6 sm:grid-cols-2">
                  {schoolClass.students.map((student) => (
                    <li key={student.id} className="flex items-center gap-3 border-b border-slate-100 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                        {student.firstName[0]}
                        {student.lastName[0]}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {student.firstName} {student.lastName}
                        </p>
                        <p className="truncate text-xs text-slate-500">{student.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="pending-title" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="pending-title" className="text-lg font-bold">
            {tPeople('pending')}
          </h2>
          {invitations.data ? (
            <InvitationList invitations={invitations.data} onChanged={invitations.reload} />
          ) : (
            <div aria-hidden className="h-24 animate-pulse rounded-xl bg-slate-100" />
          )}
        </section>
      </div>
    </div>
  );
}
