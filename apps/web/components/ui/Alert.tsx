import type { ReactNode } from 'react';

// A failure the user should notice: a load that failed, a save that was refused
export function ErrorAlert({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p role="alert" className={`rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600 ${className}`}>
      {children}
    </p>
  );
}

// A neutral explanation in place of content, e.g. "only admins can see this"
export function InfoNote({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">{children}</p>;
}
