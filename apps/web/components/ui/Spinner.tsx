const SIZES = { sm: 'h-5 w-5', md: 'h-8 w-8' };

export function Spinner({ size = 'sm' }: { size?: keyof typeof SIZES }) {
  return (
    <span aria-hidden className={`${SIZES[size]} inline-block animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600`} />
  );
}
