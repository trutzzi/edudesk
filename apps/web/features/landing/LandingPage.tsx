import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Logo } from '@/components/layout/Logo';
import { HeroActions, NavActions } from './LandingActions';

// Outline icons on a 24px grid, one per feature
const FEATURES = [
  { key: 'classes', icon: 'M4 19.5V6a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Zm0 0A2 2 0 0 1 6 18h12M8 8h6' },
  { key: 'timetable', icon: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
  { key: 'timeline', icon: 'M4 6h10M8 12h12M4 18h8' },
  { key: 'calendar', icon: 'M8 3v4m8-4v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z' },
  {
    key: 'people',
    icon: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M15 4.13a4 4 0 0 1 0 7.75M13.5 7.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  },
  { key: 'health', icon: 'M3 12h4l3-8 4 16 3-8h4' },
] as const;

const ROLES = ['admin', 'teacher', 'student'] as const;

export async function LandingPage() {
  const t = await getTranslations('Landing');

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 px-6 py-4 backdrop-blur-md lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-2 sm:gap-4">
            <LocaleSwitcher />
            <NavActions />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center lg:py-24">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            {t('badge')}
          </span>

          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            {t('titleLine1')}
            <br />
            <span className="bg-linear-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">{t('titleLine2')}</span>
          </h1>

          <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">{t('description')}</p>

          <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
            <HeroActions />
          </div>
        </section>

        <section aria-labelledby="features-title" className="border-t border-slate-200 bg-white px-6 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 id="features-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t('featuresTitle')}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-600">{t('featuresSubtitle')}</p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ key, icon }) => (
                <li key={key} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-6 w-6"
                    >
                      <path d={icon} />
                    </svg>
                  </span>
                  <h3 className="mb-2 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="leading-relaxed text-slate-600">{t(`features.${key}.text`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="roles-title" className="px-6 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl">
            <h2 id="roles-title" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t('rolesTitle')}
            </h2>
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
