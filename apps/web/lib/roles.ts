import type { Role } from '@/features/auth/AuthProvider';

const ADMIN_ROLES: Role[] = ['school_admin', 'super_admin'];

export const isAdmin = (role: Role | undefined) => Boolean(role && ADMIN_ROLES.includes(role));

// Where each role lands after signing in: admins on the overview, everyone else on their timetable
export const homeFor = (role: Role) => (isAdmin(role) ? '/dashboard' : '/dashboard/timetable');
