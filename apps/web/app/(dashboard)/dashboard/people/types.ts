import type { Role } from '@/app/context/AuthContext';

export type InvitableRole = Exclude<Role, 'super_admin'>;

// The roles in the order the page lists them
export const INVITABLE_ROLES: InvitableRole[] = ['teacher', 'student', 'parent', 'school_admin'];

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: InvitableRole;
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
