'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { homeFor, isAdmin } from '@/lib/roles';

// The overview is for admins; anyone else who opens it is sent to their own home page
export function AdminOverview({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const allowed = isAdmin(user?.role);

  useEffect(() => {
    if (user && !allowed) router.replace(homeFor(user.role));
  }, [user, allowed, router]);

  return allowed ? <>{children}</> : null;
}
