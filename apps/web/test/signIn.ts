import { STORAGE_KEY, type User } from '@/features/auth/AuthProvider';

// Puts a session in storage, which is where AuthProvider reads it from
export function signIn(overrides: Partial<User> = {}, token = 'token') {
  const user: User = {
    id: 'me',
    email: 'me@school.ro',
    firstName: 'Ana',
    lastName: 'Pop',
    role: 'school_admin',
    schoolId: 's1',
    ...overrides,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
  return user;
}
