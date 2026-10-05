export const ROLES = ['super_admin', 'school_admin', 'teacher', 'student', 'parent'] as const;
export type Role = (typeof ROLES)[number];

// The roles a school can have members in (super admins run the platform, not a school)
export const SCHOOL_ROLES = ['school_admin', 'teacher', 'student', 'parent'] as const satisfies readonly Role[];
export type SchoolRole = (typeof SCHOOL_ROLES)[number];

export const isSchoolRole = (value: unknown): value is SchoolRole => SCHOOL_ROLES.includes(value as SchoolRole);
