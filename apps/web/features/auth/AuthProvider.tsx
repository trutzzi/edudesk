'use client';

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export type Role = 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  schoolId: string | null;
  // The language saved in their profile; null (or missing, in older sessions) follows the browser
  locale?: 'ro' | 'en' | null;
}

export interface Session {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (session: Session) => void;
  logout: () => void;
}

export const STORAGE_KEY = 'edudesk.session';
const listeners = new Set<() => void>();

// `storage` covers other tabs, the local listeners cover this one
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function writeSession(session: Session | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

const login = (session: Session) => writeSession(session);
const logout = () => writeSession(null);

const getSnapshot = () => localStorage.getItem(STORAGE_KEY);

// `undefined` on the server and during hydration, so the first client render matches the HTML
const getServerSnapshot = () => undefined;

function parseSession(raw: string | null | undefined): Session | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<AuthContextValue>(() => {
    const session = parseSession(raw);
    return {
      user: session?.user ?? null,
      token: session?.token ?? null,
      loading: raw === undefined,
      login,
      logout,
    };
  }, [raw]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
