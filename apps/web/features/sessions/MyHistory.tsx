'use client';

import { useAuth } from '@/features/auth/AuthProvider';
import { ClientCard } from './ClientCard';

// A client's own card and history
export function MyHistory() {
  const { user } = useAuth();
  return user ? <ClientCard clientId={user.id} /> : null;
}
