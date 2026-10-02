'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/app/context/AuthContext';
import { ErrorAlert } from '@/components/ui/Alert';
import { buttonClass } from '@/components/ui/button';
import { compactControlClass, FormError } from '@/components/ui/Field';
import { containsText } from '@/lib/text';
import { useApi } from '@/lib/useApi';
import { useSend } from '@/lib/useSend';
import { InvitationList } from './InvitationList';
import { InviteForm } from './InviteForm';
import { INVITABLE_ROLES, type Invitation, type Member } from './types';

export function People() {
  const t = useTranslations('People');
  const members = useApi<Member[]>('/api/users');
  const invitations = useApi<Invitation[]>('/api/invitations');
  const classes = useApi<{ id: string; name: string }[]>('/api/classes');
  const { user } = useAuth();
  const { send, pending, error: removeError } = useSend();

  const [inviting, setInviting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const matching = (members.data ?? []).filter((member) =>
      containsText(`${member.firstName} ${member.lastName} ${member.email}`, search),
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

  if (members.error !== undefined) return <ErrorAlert>{t('loadError')}</ErrorAlert>;

  return (
    <div className="space-y-6">
      {inviting ? (
        <InviteForm
          classes={classes.data ?? []}
          students={(members.data ?? []).filter((member) => member.role === 'student')}
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
              ✓ {t('sent', { email: sentTo })}
            </p>
          )}
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
            <div aria-hidden className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('noMatches')}</p>
          ) : (
            groups.map(({ role, people }) => (
              <div key={role}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t(`groups.${role}`)} ({people.length})
                </h3>
                <ul className="grid gap-x-6 sm:grid-cols-2">
                  {people.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 border-b border-slate-100 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700">
                        {member.firstName[0]}
                        {member.lastName[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="truncate text-xs text-slate-500">{member.email}</p>
                      </div>
                      {member.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() => remove(member)}
                          disabled={pending}
                          aria-label={t('removeLabel', { name: `${member.firstName} ${member.lastName}` })}
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {t('remove')}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
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
            <div aria-hidden className="h-24 animate-pulse rounded-xl bg-slate-100" />
          )}
        </section>
      </div>
    </div>
  );
}
