'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { DashboardNav, hasTabBar } from '@/components/layout/DashboardNav';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { BrandingProvider } from '@/features/branding/BrandingProvider';
import { NoSchool, SchoolSetup } from '@/features/onboarding/SchoolSetup';
import { SavedLocale } from '@/features/profile/SavedLocale';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner size="md" />
      </div>
    );
  }

  // Everything in the dashboard belongs to a school; super admins oversee all of them
  const inSchool = Boolean(user.schoolId) || user.role === 'super_admin';

  return (
    <BrandingProvider>
      <SavedLocale />
      <DashboardHeader user={user} onLogout={logout} />
      {inSchool ? (
        <>
          <DashboardNav role={user.role} />
          {/* On phones the bottom tab bar covers the last 3.5rem, plus the home indicator's area */}
          <main
            className={`mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:space-y-8 sm:p-6 lg:p-8 ${
              hasTabBar(user.role) ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : ''
            }`}
          >
            {children}
          </main>
        </>
      ) : (
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{user.role === 'school_admin' ? <SchoolSetup /> : <NoSchool />}</main>
      )}
    </BrandingProvider>
  );
}
