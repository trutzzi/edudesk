const base =
  'inline-flex items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const variants = {
  primary: 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 hover:bg-indigo-700',
  secondary: 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  // For destructive actions: quiet until hovered
  danger: 'text-red-600 hover:bg-red-50 hover:text-red-700',
};

// Phones get finger-sized targets (40–44px tall); from sm up, the compact desktop sizes
const sizes = {
  sm: 'min-h-10 px-3.5 py-1.5 text-sm sm:min-h-0 sm:text-xs',
  md: 'min-h-11 px-4 py-2 text-sm sm:min-h-0',
  lg: 'px-8 py-3.5 text-base',
  block: 'mt-2 min-h-12 w-full px-4 py-3 text-base sm:text-sm',
};

export function buttonClass(variant: keyof typeof variants = 'primary', size: keyof typeof sizes = 'md') {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
