import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';

export interface ListedPerson {
  id: string;
  firstName: string;
  lastName: string;
  // People the admin created may have only a phone
  email: string | null;
  phone?: string | null;
}

interface PersonAction {
  label: string;
  // What the button does to whom, for screen readers ("Remove Ana Pop from the class")
  ariaLabel: string;
  // May be async (a removal that calls the API); its errors are the caller's to show, e.g. through useSend
  onClick: () => void | Promise<unknown>;
  disabled?: boolean;
}

interface Props<T extends ListedPerson> {
  people: T[];
  columns?: 1 | 2;
  // A button beside a person, e.g. "Remove"; none when it returns null
  action?: (person: T) => PersonAction | null;
  // More about a person under their email, e.g. a parent's children
  details?: (person: T) => ReactNode;
  // Where the name links to, e.g. a client's card
  href?: (person: T) => string | null;
}

// People with their initials, name and email: members, a class's students
export function PersonList<T extends ListedPerson>({ people, columns = 1, action, details, href }: Props<T>) {
  return (
    <ul className={columns === 2 ? 'grid gap-x-6 sm:grid-cols-2' : 'divide-y divide-slate-100'}>
      {people.map((person) => {
        const button = action?.(person);
        const link = href?.(person);
        const name = `${person.firstName} ${person.lastName}`;
        return (
          <li key={person.id} className={`flex items-center gap-3 py-2 ${columns === 2 ? 'border-b border-slate-100' : ''}`}>
            <Avatar firstName={person.firstName} lastName={person.lastName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {link ? (
                  <Link href={link} className="text-indigo-700 hover:underline">
                    {name}
                  </Link>
                ) : (
                  name
                )}
              </p>
              <p className="truncate text-xs text-slate-500">{[person.phone, person.email].filter(Boolean).join(' · ')}</p>
              {details?.(person)}
            </div>
            {button && (
              <button
                type="button"
                onClick={() => void button.onClick()}
                disabled={button.disabled}
                aria-label={button.ariaLabel}
                className="min-h-10 shrink-0 rounded-lg px-3 py-1 text-sm font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 sm:min-h-0 sm:px-2 sm:text-xs"
              >
                {button.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
