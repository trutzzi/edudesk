'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth, type Role, type Session } from '@/app/context/AuthContext';
import { api, errorMessage } from '@/lib/api';
import { homeFor } from '@/lib/roles';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/Field';

interface InvitationInfo {
  email: string;
  role: Exclude<Role, 'super_admin'>;
  schoolName: string;
  hasAccount: boolean;
}

type Lookup = { state: 'loading' } | { state: 'invalid'; message: string } | { state: 'ready'; invitation: InvitationInfo };

export function AcceptInvitation({ token }: { token: string | null }) {
  const t = useTranslations('Invite');
  const tForm = useTranslations('Form');
  const tErrors = useTranslations('Errors');
  const { login } = useAuth();
  const router = useRouter();

  const [lookup, setLookup] = useState<Lookup>(() =>
    token ? { state: 'loading' } : { state: 'invalid', message: tErrors('INVALID_INVITATION') },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed out: the token in the link is what proves the invitation
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    api<InvitationInfo>(`/api/invitations/lookup?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((invitation) => setLookup({ state: 'ready', invitation }))
      .catch((err) => {
        if (!controller.signal.aborted) setLookup({ state: 'invalid', message: errorMessage(err, tErrors) });
      });
    return () => controller.abort();
  }, [token, tErrors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      // Accepting signs in as the invited person, replacing any session already open in this browser
      const session = await api<Session>('/api/invitations/accept', { body: { ...fields, token } });
      login(session);
      router.replace(homeFor(session.user.role));
    } catch (err) {
      setError(errorMessage(err, tErrors));
      setPending(false);
    }
  }

  if (lookup.state === 'loading') {
    return (
      <p role="status" className="flex items-center justify-center gap-3 py-6 text-sm text-slate-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
        {t('loading')}
      </p>
    );
  }

  if (lookup.state === 'invalid') {
    return (
      <div className="space-y-4">
        <h1 className="text-center text-xl font-bold">{t('invalidTitle')}</h1>
        <FormError message={lookup.message} />
        <Link href="/login" className={buttonClass('secondary', 'block')}>
          {t('toSignIn')}
        </Link>
      </div>
    );
  }

  const { invitation } = lookup;
  const school = invitation.schoolName;

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">{t('title', { school })}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('intro', { school, role: t(`asRole.${invitation.role}`) })}</p>
      </div>

      <FormError message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">{t('forEmail', { email: invitation.email })}</p>
        <p className="text-sm text-slate-600">
          {invitation.hasAccount ? t('existingAccount', { school }) : t('newAccount')}
        </p>

        {!invitation.hasAccount && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={tForm('firstName')} name="firstName" autoComplete="given-name" required />
            <Field label={tForm('lastName')} name="lastName" autoComplete="family-name" required />
          </div>
        )}
        <Field
          label={tForm('password')}
          name="password"
          type="password"
          autoComplete={invitation.hasAccount ? 'current-password' : 'new-password'}
          placeholder={invitation.hasAccount ? undefined : tForm('passwordHint')}
          minLength={invitation.hasAccount ? undefined : 8}
          required
        />
        <button type="submit" disabled={pending} className={buttonClass('primary', 'block')}>
          {pending ? t('accepting') : t('accept')}
        </button>
      </form>
    </>
  );
}
