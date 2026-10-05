const SIZES = { sm: 'h-2 w-2', md: 'h-2.5 w-2.5' };

// A green dot that pulses while something is happening right now; grey and still otherwise
export function LiveDot({ live = true, size = 'sm' }: { live?: boolean; size?: keyof typeof SIZES }) {
  return (
    <span aria-hidden className={`relative flex ${SIZES[size]}`}>
      {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
      <span className={`relative inline-flex ${SIZES[size]} rounded-full ${live ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    </span>
  );
}
