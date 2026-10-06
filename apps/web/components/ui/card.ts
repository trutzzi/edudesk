// The white surface most screens are built from: forms, lists, panels
const paddings = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-8',
};

export function cardClass(padding: keyof typeof paddings = 'md') {
  return `rounded-2xl border border-slate-200 bg-white shadow-sm ${paddings[padding]}`.trimEnd();
}
