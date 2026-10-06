import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Logo } from '@/components/layout/Logo';
import { Icon } from '@/components/ui/Icon';
import { HeroActions, NavActions } from './LandingActions';

const FEATURES = ['classes', 'timetable', 'timeline', 'calendar', 'people', 'health'] as const;

const ROLES = ['admin', 'teacher', 'student'] as const;

export async function LandingPage() {
  const t = await getTranslations('Landing');

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-4">
            <LocaleSwitcher />
            <NavActions />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-16 lg:py-24">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-indigo-700 uppercase">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            {t('badge')}
          </span>

          <h1 className="mb-6 text-4xl leading-tight font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            {t('titleLine1')}
            <br />
            <span className="bg-linear-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">{t('titleLine2')}</span>
          </h1>

          <p className="mb-8 max-w-2xl text-lg leading-relaxed text-slate-600 sm:mb-10 sm:text-xl">{t('description')}</p>

          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <HeroActions />
          </div>
        </section>

        <section aria-labelledby="features-title" className="border-t border-slate-200 bg-white px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t('featuresTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">{t('featuresSubtitle')}</p>
            <ul className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {FEATURES.map((key) => (
                <li key={key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <Icon name={key} />
                  </span>
                  <h3 className="mb-2 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="leading-relaxed text-slate-600">{t(`features.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="roles-title" className="px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 id="roles-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t('rolesTitle')}
            </h2>
            <ul className="mt-8 grid gap-4 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {ROLES.map((role) => (
                <li key={role} className="rounded-2xl border-t-4 border-indigo-500 bg-white p-6 shadow-sm">
                  <h3 className="mb-2 text-lg font-semibold">{t(`roles.${role}.title`)}</h3>
                  <p className="leading-relaxed text-slate-600">{t(`roles.${role}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Blue
      </footer>
    </>
  );
}
