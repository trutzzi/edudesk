import type { ReactNode } from 'react';

// A confirmation that something just worked, e.g. "Invitation sent", announced to screen readers
export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm font-medium text-emerald-700">
      ✓ {children}
    </p>
  );
}
