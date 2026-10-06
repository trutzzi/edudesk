'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { SuccessNote } from '@/components/ui/SuccessNote';
import { useSend } from '@/lib/api/useSend';
import { applyBrandColor } from '@/lib/theme';
import { DEFAULT_APP_NAME, useBranding } from './BrandingProvider';

// Tailwind's indigo-600, the color without an institution's own
const DEFAULT_COLOR = '#4f46e5';
const SWATCHES = ['#4f46e5', '#2563eb', '#0ea5e9', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#db2777', '#7c3aed'];
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_BYTES = 512 * 1024;

// How the app looks to the institution's people: its name in place of "Blue", its main color and its logo.
// The color previews on the whole page while choosing.
export function InstitutionSettings() {
  const t = useTranslations('Institution');
  const { branding, logoSrc, reload } = useBranding();
  const { send, pending, error } = useSend();
  const [color, setColor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const shown = color ?? branding?.color ?? DEFAULT_COLOR;

  // Preview while choosing; leaving without saving puts the saved color back
  useEffect(() => {
    if (color) applyBrandColor(color);
  }, [color]);
  useEffect(() => () => applyBrandColor(branding?.color ?? null), [branding?.color]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const appName = String(new FormData(event.currentTarget).get('appName'));
    // The default color is stored as none, so it follows the app if its default ever changes
    const body = { appName, color: shown === DEFAULT_COLOR ? null : shown };
    if ((await send('/api/schools/branding', { method: 'PATCH', body })).ok) {
      setSaved(true);
      setColor(null);
      reload();
    }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setFileError(null);
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) return setFileError(t('logoType'));
    if (file.size > MAX_LOGO_BYTES) return setFileError(t('logoSize'));
    if ((await send('/api/schools/branding/logo', { method: 'PUT', body: file })).ok) reload();
  }

  async function removeLogo() {
    if ((await send('/api/schools/branding/logo', { method: 'DELETE' })).ok) reload();
  }

  if (!branding) return <Skeleton className="h-64 rounded-2xl bg-slate-200" />;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={save} aria-label={t('lookTitle')} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">{t('lookTitle')}</h2>
        <FormError message={error} />
        <div>
          <Field label={t('appName')} name="appName" defaultValue={branding.appName ?? ''} placeholder={DEFAULT_APP_NAME} maxLength={60} />
          <p className="mt-1 text-xs text-slate-500">{t('appNameHint')}</p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-700">{t('color')}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => setColor(swatch)}
                aria-label={swatch}
                aria-pressed={shown === swatch}
                className={`h-8 w-8 rounded-full ring-offset-2 ${shown === swatch ? 'ring-2 ring-slate-900' : ''}`}
                style={{ backgroundColor: swatch }}
              />
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="color"
                value={shown}
                onChange={(event) => setColor(event.target.value)}
                aria-label={t('customColor')}
                className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white"
              />
              <span className="font-mono">{shown}</span>
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('colorHint')}</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className={buttonClass()}>
            {pending ? t('saving') : t('save')}
          </button>
          {(color || branding.color) && (
            <button type="button" onClick={() => setColor(DEFAULT_COLOR)} className={buttonClass('ghost')}>
              {t('defaultColor')}
            </button>
          )}
          {saved && <SuccessNote>{t('saved')}</SuccessNote>}
        </div>
      </form>

      <section aria-labelledby="logo-title" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="logo-title" className="text-lg font-bold">
          {t('logo')}
        </h2>
        <FormError message={fileError} />
        <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API
            <img src={logoSrc} alt={t('currentLogo')} className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="text-sm text-slate-500">{t('noLogo')}</p>
          )}
        </div>
        <p className="text-xs text-slate-500">{t('logoHint')}</p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={LOGO_TYPES.join(',')}
            onChange={upload}
            className="sr-only"
            aria-label={t('chooseLogo')}
          />
          <button type="button" onClick={() => fileInput.current?.click()} disabled={pending} className={buttonClass('secondary')}>
            {logoSrc ? t('replaceLogo') : t('chooseLogo')}
          </button>
          {logoSrc && (
            <button type="button" onClick={removeLogo} disabled={pending} className={buttonClass('ghost')}>
              {t('removeLogo')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
