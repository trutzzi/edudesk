'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormError } from '@/components/ui/Field';
import { useSend } from '@/lib/api/useSend';
import type { Invitation } from './types';

interface Props {
  invitations: Invitation[];
  onChanged: () => void;
}

export function InvitationList({ invitations, onChanged }: Props) {
  const t = useTranslations('People');
  const tRoles = useTranslations('Roles');
  const format = useFormatter();
  const locale = useLocale();
  const { send, pending, error } = useSend();
  // Invitations resent in this visit, to confirm the click
  const [resent, setResent] = useState<Set<string>>(new Set());

  async function resend(invitation: Invitation) {
    const result = await send(`/api/invitations/${invitation.id}/resend`, { body: { locale } });
    if (result.ok) {
      setResent((current) => new Set(current).add(invitation.id));
      onChanged();
    }
  }

  async function revoke(invitation: Invitation) {
    if (!window.confirm(t('confirmRevoke', { email: invitation.email }))) return;
    if ((await send(`/api/invitations/${invitation.id}`, { method: 'DELETE' })).ok) onChanged();
  }

  if (invitations.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">{t('noPending')}</p>;
  }

  return (
    <>
      <FormError message={error} />
      <ul className="divide-y divide-slate-100">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="space-y-1.5 py-3">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{invitation.email}</p>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {tRoles(invitation.role)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {invitation.class && `${t('inClass', { className: invitation.class.name })} · `}
              {invitation.student && `${t('parentOf', { name: `${invitation.student.firstName} ${invitation.student.lastName}` })} · `}
              {invitation.expired ? (
                <span className="font-semibold text-red-600">{t('expired')}</span>
              ) : (
                t('expires', { date: format.dateTime(new Date(invitation.expiresAt), { day: 'numeric', month: 'short' }) })
              )}
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => resend(invitation)}
                disabled={pending}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
              >
                {resent.has(invitation.id) ? `✓ ${t('resent')}` : t('resend')}
              </button>
              <button
                type="button"
                onClick={() => revoke(invitation)}
                disabled={pending}
                aria-label={t('revokeLabel', { email: invitation.email })}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {t('revoke')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
