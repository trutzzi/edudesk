import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { HeroActions, NavActions } from '@/components/landing/AuthActions';

export default async function LandingPage() {
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

      <main className="mx-auto flex max-w-5xl flex-1 flex-col items-center justify-center px-6 py-16 text-center lg:py-24">
        <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700">
          <span className="h-2 w-2 rounded-full bg-indigo-600" />
          {t('badge')}
        </span>

        <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          {t('titleLine1')}
          <br />
          <span className="bg-linear-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            {t('titleLine2')}
          </span>
        </h1>

        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">{t('description')}</p>

        <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
          <HeroActions />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} EduDesk
      </footer>
    </>
  );
}
