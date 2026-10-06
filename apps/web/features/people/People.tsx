'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { PersonList } from '@/components/PersonList';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessNote } from '@/components/ui/SuccessNote';
import { useAuth } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';
import { containsText } from '@/lib/text';
import { InvitationList } from './InvitationList';
import { InviteForm } from './InviteForm';
import { PersonForm } from './PersonForm';
import { INVITABLE_ROLES, type Invitation, type Member } from './types';

// What the form slot above the lists shows
type Panel = { kind: 'create'; role: 'teacher' | 'student' } | { kind: 'edit'; member: Member } | { kind: 'invite' } | null;

export function People() {
  const t = useTranslations('People');
  const tPayment = useTranslations('PaymentTypes');
  const members = useApi<Member[]>('/api/users');
  const invitations = useApi<Invitation[]>('/api/invitations');
  const classes = useApi<{ id: string; name: string }[]>('/api/classes');
  const { user } = useAuth();
  const { send, pending, error: removeError } = useSend();

  const [panel, setPanel] = useState<Panel>(null);
  const [note, setNote] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const matching = (members.data ?? []).filter((member) =>
      containsText(`${member.firstName} ${member.lastName} ${member.email ?? ''} ${member.phone ?? ''}`, search),
    );
    return INVITABLE_ROLES.map((role) => ({ role, people: matching.filter((member) => member.role === role) })).filter(
      ({ people }) => people.length > 0,
    );
  }, [members.data, search]);

  async function remove(member: Member) {
    const name = `${member.firstName} ${member.lastName}`;
    if (!window.confirm(t('confirmRemove', { name }))) return;
    if ((await send(`/api/users/${member.id}`, { method: 'DELETE' })).ok) members.reload();
  }

  function open(next: Panel) {
    setNote(null);
    setPanel(next);
  }

  function saved(message: string) {
    setPanel(null);
    setNote(message);
    members.reload();
  }

  if (members.error !== undefined) return <ErrorAlert>{t('loadError')}</ErrorAlert>;

  return (
    <div className="space-y-6">
      {panel?.kind === 'invite' ? (
        <InviteForm
          classes={classes.data ?? []}
          onCancel={() => setPanel(null)}
          onSent={(email) => {
            setPanel(null);
            setNote(t('sent', { email }));
            invitations.reload();
          }}
        />
      ) : panel?.kind === 'create' ? (
        <PersonForm
          role={panel.role}
          classes={classes.data ?? []}
          onCancel={() => setPanel(null)}
          onSaved={(password) => saved(t('created', { password: password ?? '' }))}
        />
      ) : panel?.kind === 'edit' ? (
        <PersonForm
          role={panel.member.role === 'teacher' ? 'teacher' : 'student'}
          member={panel.member}
          classes={classes.data ?? []}
          onCancel={() => setPanel(null)}
          onSaved={(password) => saved(password ? t('updatedPassword', { password }) : t('updated'))}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => open({ kind: 'create', role: 'student' })} className={buttonClass()}>
            + {t('addClient')}
          </button>
          <button type="button" onClick={() => open({ kind: 'create', role: 'teacher' })} className={buttonClass()}>
            + {t('addTherapist')}
          </button>
          <button type="button" onClick={() => open({ kind: 'invite' })} className={buttonClass('secondary')}>
            {t('invite')}
          </button>
          {note && <SuccessNote>{note}</SuccessNote>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="members-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="members-title" className="text-lg font-bold">
              {t('members')} <span className="text-sm font-medium text-slate-400">({members.data?.length ?? 0})</span>
            </h2>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className={`w-full sm:w-64 ${compactControlClass}`}
            />
          </div>

          <FormError message={removeError} />
          {!members.data ? (
            <Skeleton className="h-40 rounded-xl bg-slate-100" />
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('noMatches')}</p>
          ) : (
            groups.map(({ role, people }) => (
              <div key={role}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t(`groups.${role}`)} ({people.length})
                </h3>
                <PersonList
                  people={people}
                  columns={2}
                  href={(member) => (member.role === 'student' ? `/dashboard/clients/${member.id}` : null)}
                  details={(member) =>
                    member.role === 'school_admin' ? null : (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        {member.role === 'student' && member.paymentType && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                            {tPayment(member.paymentType)}
                          </span>
                        )}
                        {member.specializations.map((therapy) => (
                          <span key={therapy.id} className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                            {therapy.name}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => open({ kind: 'edit', member })}
                          aria-label={t('editLabel', { name: `${member.firstName} ${member.lastName}` })}
                          className="font-semibold text-indigo-600 hover:underline"
                        >
                          {t('edit')}
                        </button>
                      </div>
                    )
                  }
                  action={(member) =>
                    member.id === user?.id
                      ? null
                      : {
                          label: t('remove'),
                          ariaLabel: t('removeLabel', { name: `${member.firstName} ${member.lastName}` }),
                          onClick: () => remove(member),
                          disabled: pending,
                        }
                  }
                />
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="pending-title" className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 id="pending-title" className="text-lg font-bold">
            {t('pending')}
          </h2>
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
