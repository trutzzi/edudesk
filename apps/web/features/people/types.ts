import type { Role } from '@/features/auth/AuthProvider';

export type InvitableRole = Exclude<Role, 'super_admin' | 'parent'>;

// The roles in the order the page lists them
export const INVITABLE_ROLES: InvitableRole[] = ['teacher', 'student', 'school_admin'];

export const PAYMENT_TYPES = ['cas', 'sponsored'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  // Clients and therapists the admin created may have only a phone
  email: string | null;
  phone: string | null;
  role: InvitableRole;
  // A client's; null for everyone else
  paymentType: PaymentType | null;
  // A therapist's therapies; empty for everyone else
  specializations: { id: string; name: string }[];
  details: string | null;
  notes: string | null;
  // The app's language for them; null follows their browser
  locale: 'ro' | 'en' | null;
}

export interface Invitation {
  id: string;
  email: string;
  role: InvitableRole;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  class: { id: string; name: string } | null;
  student: { id: string; firstName: string; lastName: string } | null;
}
