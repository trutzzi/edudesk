import type { ReactNode } from 'react';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Logo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 sm:py-12">
      <div className="mb-4 flex w-full max-w-md justify-end">
        <LocaleSwitcher />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
        <div className="mb-3 flex justify-center">
          <Logo size="lg" />
        </div>
        {children}
      </div>
    </main>
  );
}
