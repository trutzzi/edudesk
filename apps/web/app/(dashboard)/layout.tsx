'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { DashboardNav } from '@/components/layout/DashboardNav';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { NoSchool, SchoolSetup } from '@/features/onboarding/SchoolSetup';

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
    <>
      <DashboardHeader user={user} onLogout={logout} />
      {inSchool ? (
        <>
          <DashboardNav role={user.role} />
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-8 p-6 lg:p-8">{children}</main>
        </>
      ) : (
        <main className="flex-1 p-6 lg:p-8">{user.role === 'school_admin' ? <SchoolSetup /> : <NoSchool />}</main>
      )}
    </>
  );
}
