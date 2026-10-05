import Link from 'next/link';

const sizes = {
  md: { mark: 'h-8 w-8 rounded-lg text-lg', text: 'text-xl' },
  lg: { mark: 'h-9 w-9 rounded-xl text-xl', text: 'text-2xl' },
};

export function Logo({ size = 'md' }: { size?: keyof typeof sizes }) {
  const { mark, text } = sizes[size];

  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={`${mark} flex items-center justify-center bg-indigo-600 font-black text-white shadow-md shadow-indigo-200`}
      >
        E
      </span>
      <span className={`${text} font-extrabold tracking-tight text-indigo-600`}>EduDesk</span>
    </Link>
  );
}
