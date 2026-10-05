const SIZES = {
  sm: 'h-8 w-8 bg-indigo-50 text-xs',
  md: 'h-9 w-9 border border-indigo-200 bg-indigo-100 text-sm',
};

export function Avatar({ firstName, lastName, size = 'sm' }: { firstName: string; lastName: string; size?: keyof typeof SIZES }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-bold text-indigo-700 ${SIZES[size]}`}>
      {firstName[0]}
      {lastName[0]}
    </span>
  );
}
