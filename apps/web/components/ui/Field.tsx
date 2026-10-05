import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ErrorAlert } from './Alert';

// text-base on phones: iOS zooms the whole page into any input under 16px
const controlClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 sm:text-sm placeholder-slate-400 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
}

export function Field({ label, name, id = name, ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input id={id} name={name} className={controlClass} {...props} />
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  children: ReactNode;
}

export function SelectField({ label, name, id = name, children, ...props }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <select id={id} name={name} className={controlClass} {...props}>
        {children}
      </select>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <ErrorAlert className="mb-6">{message}</ErrorAlert>;
}

// The smaller control used in toolbars and dense tables
export const compactControlClass =
  'min-h-10 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-base text-slate-700 sm:min-h-0 sm:text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500';
