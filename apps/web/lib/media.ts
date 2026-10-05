// True on phone-sized screens (below Tailwind's sm breakpoint). Only for picking a starting view:
// layout itself stays in CSS. Dashboard screens render in the browser only, so window is there.
export const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches === true;
