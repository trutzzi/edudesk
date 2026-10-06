import type { ReactNode } from 'react';

// "No students in this class yet.": what a list says when it has nothing to show
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}
