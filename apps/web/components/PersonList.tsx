import { Avatar } from '@/components/ui/Avatar';

export interface ListedPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface PersonAction {
  label: string;
  // What the button does to whom, for screen readers ("Remove Ana Pop from the class")
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
}

interface Props<T extends ListedPerson> {
  people: T[];
  columns?: 1 | 2;
  // A button beside a person, e.g. "Remove"; none when it returns null
  action?: (person: T) => PersonAction | null;
}

// People with their initials, name and email: members, a class's students
export function PersonList<T extends ListedPerson>({ people, columns = 1, action }: Props<T>) {
  return (
    <ul className={columns === 2 ? 'grid gap-x-6 sm:grid-cols-2' : 'divide-y divide-slate-100'}>
      {people.map((person) => {
        const button = action?.(person);
        return (
          <li key={person.id} className={`flex items-center gap-3 py-2 ${columns === 2 ? 'border-b border-slate-100' : ''}`}>
            <Avatar firstName={person.firstName} lastName={person.lastName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {person.firstName} {person.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{person.email}</p>
            </div>
            {button && (
              <button
                type="button"
                onClick={button.onClick}
                disabled={button.disabled}
                aria-label={button.ariaLabel}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
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
