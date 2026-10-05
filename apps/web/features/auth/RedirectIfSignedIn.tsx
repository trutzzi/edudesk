'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { homeFor } from '@/lib/roles';
import { useAuth } from './AuthProvider';

// For the sign-in, sign-up and verify pages: covers both opening them while signed in
// and the moment a sign-in succeeds. Not for /invite, which may be opened while signed in as someone else.
export function RedirectIfSignedIn() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  return null;
}
