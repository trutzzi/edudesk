'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { api, errorMessage } from '@/lib/api';
import { buttonClass } from '@/components/ui/button';

export function ResendVerification({ email }: { email: string }) {
  const t = useTranslations('Resend');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState('sending');
    setError(null);
    try {
      await api('/api/auth/resend-verification', { body: { email, locale } });
      setState('sent');
    } catch (err) {
      setError(errorMessage(err, tErrors));
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {t('sent')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={resend} disabled={state === 'sending'} className={buttonClass('secondary', 'block')}>
        {state === 'sending' ? t('sending') : t('button')}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
