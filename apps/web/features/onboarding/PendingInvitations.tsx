'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { buttonClass } from '@/components/ui/button';
import { FormError } from '@/components/ui/Field';
import { useAuth, type Role, type Session } from '@/features/auth/AuthProvider';
import { useApi } from '@/lib/api/useApi';
import { useSend } from '@/lib/api/useSend';

interface MyInvitation {
  id: string;
  role: Exclude<Role, 'super_admin'>;
  schoolName: string;
  invitedBy: string | null;
  className: string | null;
}

interface Props {
  // What to show when there are no invitations; `checkAgain` looks for ones sent since the page opened
  empty?: (checkAgain: () => void) => ReactNode;
}

// Invitations addressed to the signed-in user's email, each joinable with one click
export function PendingInvitations({ empty }: Props) {
  const t = useTranslations('MyInvitations');
  const tInvite = useTranslations('Invite');
  const { login } = useAuth();
  const invitations = useApi<MyInvitation[]>('/api/invitations/mine');
  const { send, pending, error } = useSend();

  async function join(invitation: MyInvitation) {
    const result = await send<Session>(`/api/invitations/mine/${invitation.id}/accept`, { method: 'POST' });
    // The new session knows the school, so the dashboard opens straight away
    if (result.ok) login(result.data);
  }

  if (!invitations.data) return null;
  if (invitations.data.length === 0) return <>{empty?.(invitations.reload)}</>;

  return (
    <section aria-labelledby="my-invitations-title" className="space-y-3">
      <h2 id="my-invitations-title" className="text-sm font-bold tracking-wide text-slate-500 uppercase">
        {t('title')}
      </h2>
      <FormError message={error} />
      <ul className="space-y-3">
        {invitations.data.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {t('invitedAs', { school: invitation.schoolName, role: tInvite(`asRole.${invitation.role}`) })}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {invitation.invitedBy && t('invitedBy', { name: invitation.invitedBy })}
                {invitation.className && ` · ${t('inClass', { className: invitation.className })}`}
              </p>
            </div>
            <button type="button" onClick={() => join(invitation)} disabled={pending} className={buttonClass()}>
              {pending ? t('joining') : t('join', { school: invitation.schoolName })}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
