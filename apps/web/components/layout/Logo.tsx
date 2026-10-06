'use client';

import Link from 'next/link';
import { useBranding } from '@/features/branding/BrandingProvider';

const sizes = {
  md: { mark: 'h-8 w-8 rounded-lg text-lg', image: 'h-8 max-w-32', text: 'text-xl' },
  lg: { mark: 'h-9 w-9 rounded-xl text-xl', image: 'h-9 max-w-36', text: 'text-2xl' },
};

// The app's name with its mark: the institution's logo and name once signed in, otherwise Blue's
export function Logo({ size = 'md' }: { size?: keyof typeof sizes }) {
  const { mark, image, text } = sizes[size];
  const { appName, logoSrc } = useBranding();

  return (
    <Link href="/" className="inline-flex min-w-0 items-center gap-2">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API, not something next/image should optimize
        <img src={logoSrc} alt="" className={`${image} w-auto shrink-0 object-contain`} />
      ) : (
        <span
          aria-hidden
          className={`${mark} flex shrink-0 items-center justify-center bg-indigo-600 font-black text-white shadow-md shadow-indigo-200`}
        >
          {appName.charAt(0).toUpperCase()}
        </span>
      )}
      <span className={`${text} truncate font-extrabold tracking-tight text-indigo-600`}>{appName}</span>
    </Link>
  );
}
