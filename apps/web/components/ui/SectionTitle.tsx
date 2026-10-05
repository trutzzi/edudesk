import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // For aria-labelledby on the section it names
  id?: string;
  // Shown after the title in grey, e.g. "Members (39)"
  count?: number;
  as?: 'h2' | 'h3';
}

// The heading of a card or panel
export function SectionTitle({ children, id, count, as: Heading = 'h2' }: Props) {
  return (
    <Heading id={id} className="text-lg font-bold">
      {children}
      {count !== undefined && <span className="text-sm font-medium text-slate-400"> ({count})</span>}
    </Heading>
  );
}
