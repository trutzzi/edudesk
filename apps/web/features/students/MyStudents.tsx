'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PersonList } from '@/components/PersonList';
import { ErrorAlert, InfoNote } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { cardClass } from '@/components/ui/card';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessNote } from '@/components/ui/SuccessNote';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Person } from '@/features/classes/types';
import { InvitationList } from '@/features/people/InvitationList';
import { InviteForm } from '@/features/people/InviteForm';
import type { Invitation } from '@/features/people/types';
import { useApi } from '@/lib/api/useApi';
import { colorFor } from '@/lib/colors';

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
  if (!classes.data) return <Skeleton className="h-48 rounded-2xl bg-slate-200" />;
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
          {sentTo && <SuccessNote>{tPeople('sent', { email: sentTo })}</SuccessNote>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="classes-title" className="space-y-4">
          <h2 id="classes-title" className="sr-only">
            {t('classes')}
          </h2>
          {classes.data.map((schoolClass) => (
            <article key={schoolClass.id} aria-labelledby={`class-${schoolClass.id}`} className={cardClass()}>
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${colorFor(schoolClass.id).dot}`} />
                <SectionTitle as="h3" id={`class-${schoolClass.id}`}>
                  {schoolClass.name}
                </SectionTitle>
                <span className="text-sm text-slate-400">
                  {schoolClass.schoolYear} · {schoolClass.students.length}
                </span>
              </div>
              {schoolClass.students.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">{t('noStudents')}</p>
              ) : (
                <div className="mt-3">
                  <PersonList people={schoolClass.students} columns={2} />
                </div>
              )}
            </article>
          ))}
        </section>

        <section aria-labelledby="pending-title" className={`space-y-2 ${cardClass()}`}>
          <SectionTitle id="pending-title">{tPeople('pending')}</SectionTitle>
          {invitations.data ? (
            <InvitationList invitations={invitations.data} onChanged={invitations.reload} />
          ) : (
            <Skeleton className="h-24 rounded-xl bg-slate-100" />
          )}
        </section>
      </div>
    </div>
  );
}
